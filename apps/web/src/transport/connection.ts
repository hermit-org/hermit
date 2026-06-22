/**
 * Minimal Server-Sent Events (SSE) frame parser.
 *
 * Inlined from `@hermit-org/stdio-to-sse` so the web client does not pull in the
 * Node-only `server.ts`/`client.ts` modules (which reference `node:http`,
 * `Buffer`, etc.) during type-checking.
 */
function parseSse(buffer: string): { data: string[]; remainder: string } {
  const data: string[] = [];
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");
    const payload: string[] = [];

    for (const line of lines) {
      if (line.startsWith(":")) continue; // comment / keep-alive
      if (line.startsWith("data: ")) {
        payload.push(line.slice(6));
      }
    }

    if (payload.length > 0) {
      data.push(payload.join("\n"));
    }
  }

  return { data, remainder };
}

/**
 * Connection state of the browser SSE transport.
 */
export type WebSseConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface WebSseMessageEvent {
  type: "message";
  data: string;
}

export interface WebSseErrorEvent {
  type: "error";
  error: Error;
}

export interface WebSseStateEvent {
  type: "state";
  state: WebSseConnectionState;
}

export interface WebSseCloseEvent {
  type: "close";
}

export type WebSseEvent =
  | WebSseMessageEvent
  | WebSseErrorEvent
  | WebSseStateEvent
  | WebSseCloseEvent;

export interface WebSseConnectionOptions {
  /** URL of the gateway SSE endpoint. */
  url: string;
  /** Optional HTTP headers (e.g. Authorization). */
  headers?: Record<string, string>;
  /**
   * Interval in ms to expect SSE traffic before considering the connection
   * stale and triggering a reconnect (default: `60000`).
   */
  heartbeatTimeout?: number;
  /** Interval between reconnect attempts (default: `1000`). */
  reconnectDelay?: number;
  /** Maximum reconnect delay (default: `30000`). */
  maxReconnectDelay?: number;
  /** Maximum reconnect attempts (default: `10`). */
  maxReconnectAttempts?: number;
  /** Jitter factor for reconnect delays (default: `0.25`). */
  jitter?: number;
}

/**
 * Browser SSE transport backed by `fetch` streaming.
 *
 * The native browser `EventSource` cannot set custom headers (so it cannot
 * send `Authorization: Bearer ...`), and the Hermit gateway requires a bearer
 * token. We therefore use `fetch` with a streaming response body, which does
 * support headers, to read the persistent SSE stream.
 *
 * The shape intentionally mirrors `RnSseConnection` from
 * `@hermit-org/stdio-to-sse_rn` so that the ACP client is portable between web and
 * React Native.
 */
export class WebSseConnection {
  private state: WebSseConnectionState = "disconnected";
  private abortController?: AbortController;
  private reconnectCount = 0;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private readonly eventListeners: Set<(event: WebSseEvent) => void> = new Set();
  private readonly messageQueue: string[] = [];
  private waiters: Array<{
    resolve: (value: string | undefined) => void;
    reject: (reason: Error) => void;
  }> = [];
  private done = false;

  constructor(private readonly options: WebSseConnectionOptions) {}

  get currentState(): WebSseConnectionState {
    return this.state;
  }

  addEventListener(listener: (event: WebSseEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    if (this.state === "connecting" || this.state === "connected") {
      throw new Error("Connection is already open");
    }
    this.done = false;
    await this.doConnect();
  }

  disconnect(): void {
    this.clearTimers();
    this.abortController?.abort();
    this.abortController = undefined;
    this.setState("disconnected");
    this.done = true;
    this.flushError(new Error("Connection closed by client"));
    this.emit({ type: "close" });
  }

  /**
   * Return an async iterator over SSE payloads. Completes when the connection
   * closes gracefully or errors.
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
        return Promise.resolve({
          done: true,
          value: undefined,
        } as IteratorResult<string>);
      },
    };
  }

  private async doConnect(): Promise<void> {
    this.setState("connecting");

    const {
      url,
      headers = {},
      heartbeatTimeout = 60000,
    } = this.options;

    this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...headers,
        },
        signal: this.abortController.signal,
        // Keep the connection alive indefinitely.
        cache: "no-store",
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `HTTP error ${response.status}: ${text || response.statusText}`,
        );
      }

      this.reconnectCount = 0;
      this.setState("connected");
      this.resetHeartbeat(heartbeatTimeout);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Detach reading so it runs in the background and pushes into the queue.
      void this.readLoop(reader, decoder, buffer);
    } catch (error) {
      // If aborted by disconnect(), don't treat as a reconnectable error.
      if (this.state === "disconnected") return;

      const err = error instanceof Error ? error : new Error(String(error));
      this.emit({ type: "error", error: err });
      this.scheduleReconnect();
    }
  }

  private async readLoop(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string,
  ): Promise<void> {
    const { heartbeatTimeout = 60000 } = this.options;
    let buffer = initialBuffer;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        this.resetHeartbeat(heartbeatTimeout);
        buffer += decoder.decode(value, { stream: true });

        const { data, remainder } = parseSse(buffer);
        buffer = remainder;

        for (const item of data) {
          // A single SSE frame may carry multiple newline-delimited JSON-RPC
          // messages; split so the consumer always sees individual lines.
          for (const line of item.split("\n")) {
            if (line.length > 0) {
              this.pushMessage(line);
            }
          }
        }
      }
    } catch (error) {
      if (this.state !== "disconnected") {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit({ type: "error", error: err });
        this.scheduleReconnect();
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }
  }

  private pushMessage(line: string): void {
    this.messageQueue.push(line);
    this.flushWaiters();
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
      this.doConnect().catch((error: unknown) => {
        this.emit({
          type: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        });
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
      this.abortController?.abort();
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

  private setState(next: WebSseConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.emit({ type: "state", state: next });
  }

  private emit(event: WebSseEvent): void {
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
