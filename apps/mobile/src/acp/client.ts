import {
  createStdioLikeSse,
  type StdioLikeSse,
  type RnSseEvent,
} from "@hermit-org/stdio-to-sse_rn";
import {
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
  type AcpAgentInfo,
} from "../types";
import {
  createRequest,
  createNotification,
  encodeJsonRpcMessage,
  isSuccessResponse,
  isErrorResponse,
  isNotification,
  parseJsonRpcLine,
} from "./jsonrpc";

export interface AcpClientOptions {
  sseUrl: string;
  sendUrl: string;
  token: string;
}

export interface AcpClient {
  /** True while the SSE connection is established. */
  connected: boolean;
  /** Human-readable connection state label. */
  state: string;
  /** Last transport error, if any. */
  error: Error | null;
  /** Connect to the gateway. */
  connect(): Promise<void>;
  /** Disconnect from the gateway. */
  disconnect(): void;
  /** Send a request and wait for the matching response. */
  request<T = unknown, R = unknown>(method: string, params?: T): Promise<R>;
  /** Send a notification (fire-and-forget). */
  notify<T = unknown>(method: string, params?: T): Promise<void>;
  /** Subscribe to agent-to-client notifications. */
  onNotification(listener: (message: JsonRpcMessage) => void): () => void;
  /** Subscribe to raw transport events. */
  onTransportEvent(listener: (event: RnSseEvent) => void): () => void;
}

const PING_METHOD = "$/ping";
const PONG_METHOD = "$/pong";

export function createAcpClient(options: AcpClientOptions): AcpClient {
  const { sseUrl, sendUrl, token } = options;

  let stdio: StdioLikeSse | null = null;
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const notificationListeners = new Set<(message: JsonRpcMessage) => void>();
  const transportListeners = new Set<(event: RnSseEvent) => void>();
  let reading = false;

  const state = {
    connected: false,
    state: "disconnected",
    error: null as Error | null,
  };

  const updateState = (next: Partial<typeof state>): void => {
    Object.assign(state, next);
  };

  const emitTransportEvent = (event: RnSseEvent): void => {
    for (const listener of transportListeners) {
      try {
        listener(event);
      } catch {
        // ignore consumer errors
      }
    }
  };

  const sendNotification = async <T>(method: string, params?: T): Promise<void> => {
    if (!stdio) throw new Error("Not connected");
    const notification = createNotification<T>(method, params);
    await stdio.stdin.write(encodeJsonRpcMessage(notification));
  };

  const handleLine = (line: string): void => {
    const message = parseJsonRpcLine(line);
    if (!message) return;

    if (isNotification(message)) {
      // Handle internal heartbeats transparently.
      if (message.method === PING_METHOD) {
        void sendNotification(PONG_METHOD);
        return;
      }
      for (const listener of notificationListeners) {
        try {
          listener(message);
        } catch {
          // ignore consumer errors
        }
      }
      return;
    }

    if ("id" in message) {
      const resolver = pending.get(String(message.id));
      if (!resolver) return;
      pending.delete(String(message.id));

      if (isErrorResponse(message)) {
        resolver.reject(new Error(message.error.message));
      } else if (isSuccessResponse(message)) {
        resolver.resolve(message.result);
      }
    }
  };

  const startReader = async (): Promise<void> => {
    if (!stdio || reading) return;
    reading = true;

    try {
      for await (const line of stdio.stdout) {
        handleLine(line);
      }
    } catch (error) {
      updateState({ error: error instanceof Error ? error : new Error(String(error)) });
    } finally {
      reading = false;
      updateState({ connected: false, state: "disconnected" });
    }
  };

  const client: AcpClient = {
    get connected() {
      return state.connected;
    },
    get state() {
      return state.state;
    },
    get error() {
      return state.error;
    },

    async connect(): Promise<void> {
      if (stdio) {
        throw new Error("Already connected");
      }

      stdio = createStdioLikeSse({
        url: sseUrl,
        sendUrl,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      stdio.addEventListener((event: RnSseEvent) => {
        emitTransportEvent(event);
        if (event.type === "state") {
          updateState({
            state: event.state,
            connected: event.state === "connected",
          });
        } else if (event.type === "error") {
          updateState({ error: event.error });
        }
      });

      await stdio.connection.connect();
      void startReader();
    },

    disconnect(): void {
      pending.forEach(({ reject }) => reject(new Error("Connection closed")));
      pending.clear();
      stdio?.connection.disconnect();
      stdio = null;
      updateState({ connected: false, state: "disconnected", error: null });
    },

    async request<T, R>(method: string, params?: T): Promise<R> {
      if (!stdio) throw new Error("Not connected");

      const request = createRequest<T>(method, params);
      return new Promise<R>((resolve, reject) => {
        pending.set(String(request.id), {
          resolve: (value: unknown) => resolve(value as R),
          reject,
        });

        stdio!.stdin.write(encodeJsonRpcMessage(request)).catch((error: unknown) => {
          pending.delete(String(request.id));
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });
    },

    notify: sendNotification,

    onNotification(listener: (message: JsonRpcMessage) => void): () => void {
      notificationListeners.add(listener);
      return () => notificationListeners.delete(listener);
    },

    onTransportEvent(listener: (event: RnSseEvent) => void): () => void {
      transportListeners.add(listener);
      return () => transportListeners.delete(listener);
    },
  };

  return client;
}

/** Convenience helper to discover basic agent info over ACP. */
export async function getAgentInfo(client: AcpClient): Promise<AcpAgentInfo> {
  return client.request<unknown, AcpAgentInfo>("$/agent/info");
}
