import {
  RnSseConnectionOptions,
  RnSseConnectionState,
  RnSseEvent,
} from "./types";
import EventSource from "react-native-sse";

/**
 * Minimal runtime-agnostic shape of `react-native-sse` EventSource.
 *
 * We describe only the surface we need so the package does not depend on
 * `@types/react-native-sse` at build time.
 */
type EventSourceLike = InstanceType<typeof EventSource>;

/**
 * React Native SSE transport that exposes a stdio-like readable interface.
 *
 * Characteristics:
 *   - Each `connect(body)` opens one POST -> SSE request; the body becomes the
 *     child process stdin and SSE payloads become stdout lines.
 *   - Automatic reconnection with exponential backoff and jitter when the
 *     connection drops unexpectedly before it is explicitly closed.
 *   - Heartbeat watchdog: if no traffic is received within `heartbeatTimeout`,
 *     the transport closes and reconnects.
 *   - Incoming bytes are accumulated and split into UTF-8 line-delimited
 *     frames, preserving multi-byte character boundaries.
 *
 * This class is intentionally free of Node.js APIs and can run inside a React
 * Native Hermes JSC/V8 engine.
 */
export class RnSseConnection {
  private state: RnSseConnectionState = "disconnected";
  private eventSource?: EventSourceLike;
  private reconnectCount = 0;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pendingBody?: string;
  private readonly eventListeners: Set<(event: RnSseEvent) => void> =
    new Set();
  private readonly messageQueue: string[] = [];
  private waiters: Array<{
    resolve: (value: string | undefined) => void;
    reject: (reason: Error) => void;
  }> = [];
  private done = false;

  constructor(private readonly options: RnSseConnectionOptions) {}

  /**
   * Current connection state.
   */
  get currentState(): RnSseConnectionState {
    return this.state;
  }

  /**
   * Subscribe to state, message, and error events.
   */
  addEventListener(listener: (event: RnSseEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Open the SSE connection. `body` is sent as the POST body and becomes the
   * stdin of the remote stdio process.
   */
  async connect(body?: string): Promise<void> {
    if (this.state === "connecting" || this.state === "connected") {
      throw new Error("Connection is already open");
    }

    this.pendingBody = body;
    this.done = false;
    await this.doConnect();
  }

  /**
   * Close the connection and cancel any pending reconnect attempts.
   */
  disconnect(): void {
    this.clearTimers();
    this.eventSource?.close();
    this.eventSource = undefined;
    this.setState("disconnected");
    this.done = true;
    this.flushError(new Error("Connection closed by client"));
    this.emit({ type: "close" });
  }

  /**
   * Convenience helper that opens a connection, yields every SSE payload, and
   * closes the connection when the stream ends or errors.
   */
  async *send(body?: string): AsyncGenerator<string> {
    await this.connect(body);

    try {
      while (!this.done) {
        const message = await this.nextMessage();
        if (message === undefined) break;
        yield message;
      }
    } finally {
      this.disconnect();
    }
  }

  /**
   * Return an async iterator over SSE payloads. The iterator completes when
   * the connection closes gracefully or errors.
   */
  [Symbol.asyncIterator](): AsyncIterator<string> {
    return {
      next: async () => {
        const value = await this.nextMessage();
        if (value === undefined) {
          return { done: true, value: undefined } as IteratorResult<string>;
        }
        return { done: false, value } as IteratorResult<string>;
      },
      return: () => {
        this.disconnect();
        return Promise.resolve({ done: true, value: undefined } as IteratorResult<string>);
      },
    };
  }

  /**
   * Expose the incoming SSE payloads as a WHATWG ReadableStream.
   *
   * This lets consumers treat the remote stdio process stdout as a standard
   * web stream, which is useful for adapters and interoperability.
   */
  toReadableStream(): ReadableStream<string> {
    const self = this;
    return new ReadableStream<string>({
      async start(controller) {
        const unsubscribe = self.addEventListener((event) => {
          if (event.type === "message") {
            controller.enqueue(event.data);
          } else if (event.type === "error") {
            controller.error(event.error);
            unsubscribe();
          } else if (event.type === "close") {
            controller.close();
            unsubscribe();
          }
        });
      },
      cancel() {
        self.disconnect();
      },
    });
  }

  private async doConnect(): Promise<void> {
    this.setState("connecting");

    return new Promise((resolve, reject) => {
      const {
        url,
        headers = {},
        body,
        heartbeatTimeout = 60000,
      } = this.options;

      const effectiveBody = body ?? this.pendingBody;

      let resolved = false;
      const onOpen = (event: { type: string; data?: string; message?: string }): void => {
        if (resolved) return;
        resolved = true;
        this.reconnectCount = 0;
        this.setState("connected");
        this.resetHeartbeat(heartbeatTimeout);
        resolve();
      };

      const onError = (event: { type: string; data?: string; message?: string }): void => {
        const message = event.message ?? event.data ?? "SSE error";
        const error = new Error(message);

        if (!resolved) {
          resolved = true;
          this.setState("error");
          reject(error);
          return;
        }

        this.emit({ type: "error", error });
        this.scheduleReconnect();
      };

      const onMessage = (event: { type: string; data?: string; message?: string }): void => {
        this.resetHeartbeat(heartbeatTimeout);

        const payload = event.data ?? "";
        if (!payload) return;

        // ACP gateways usually send one JSON-RPC line per SSE data frame, but
        // SSE allows multi-line payloads. Split on newlines so the consumer
        // always receives individual delimited lines.
        const lines = payload.split("\n").filter((line) => line.length > 0);
        for (const line of lines) {
          this.messageQueue.push(line);
        }
        this.flushWaiters();
      };

      const onClose = (event: { type: string; data?: string; message?: string }): void => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Connection closed before open"));
          return;
        }
        this.scheduleReconnect();
      };

      const eventSource = new EventSource(url, {
        headers,
        body: effectiveBody,
        method: effectiveBody === undefined ? "GET" : "POST",
        pollingInterval: 0,
      });
      this.eventSource = eventSource;

      eventSource.addEventListener("open", onOpen as Parameters<EventSourceLike["addEventListener"]>[1]);
      eventSource.addEventListener("message", onMessage as Parameters<EventSourceLike["addEventListener"]>[1]);
      eventSource.addEventListener("error", onError as Parameters<EventSourceLike["addEventListener"]>[1]);
      eventSource.addEventListener("close", onClose as Parameters<EventSourceLike["addEventListener"]>[1]);
    });
  }

  private scheduleReconnect(): void {
    if (this.state === "disconnected") return;

    this.setState("reconnecting");

    const {
      reconnectDelay = 1000,
      maxReconnectDelay = 30000,
      maxReconnectAttempts = 10,
      jitter = 0.25,
    } = this.options;

    if (this.reconnectCount >= maxReconnectAttempts) {
      this.flushError(new Error("Maximum reconnection attempts exceeded"));
      this.disconnect();
      return;
    }

    const baseDelay = Math.min(
      reconnectDelay * 2 ** this.reconnectCount,
      maxReconnectDelay,
    );
    const delay = baseDelay * (1 + (Math.random() * 2 - 1) * jitter);
    this.reconnectCount++;

    this.clearTimers();
    this.reconnectTimer = setTimeout(() => {
      this.doConnect().catch((error) => {
        this.emit({ type: "error", error });
        this.scheduleReconnect();
      });
    }, Math.max(0, delay));
  }

  private resetHeartbeat(timeout: number): void {
    this.clearHeartbeat();
    if (timeout <= 0) return;
    this.heartbeatTimer = setTimeout(() => {
      this.emit({
        type: "error",
        error: new Error("Heartbeat timeout; reconnecting"),
      });
      this.eventSource?.close();
      this.scheduleReconnect();
    }, timeout);
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private setState(next: RnSseConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.emit({ type: "state", state: next });
  }

  private emit(event: RnSseEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Protect the transport from consumer errors.
      }
    }
  }

  private nextMessage(): Promise<string | undefined> {
    if (this.messageQueue.length > 0) {
      const value = this.messageQueue.shift()!;
      return Promise.resolve(value);
    }

    if (this.done) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  private flushWaiters(): void {
    while (this.waiters.length > 0 && this.messageQueue.length > 0) {
      const waiter = this.waiters.shift()!;
      const value = this.messageQueue.shift()!;
      waiter.resolve(value);
    }
  }

  private flushError(error: Error): void {
    this.done = true;
    for (const waiter of this.waiters) {
      waiter.reject(error);
    }
    this.waiters = [];
  }

}
