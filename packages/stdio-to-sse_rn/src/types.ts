/**
 * Connection state of the React Native SSE transport.
 */
export type RnSseConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Event emitted by the transport.
 */
export interface RnSseMessageEvent {
  type: "message";
  data: string;
}

export interface RnSseErrorEvent {
  type: "error";
  error: Error;
}

export interface RnSseStateEvent {
  type: "state";
  state: RnSseConnectionState;
}

export interface RnSseCloseEvent {
  type: "close";
}

export type RnSseEvent =
  | RnSseMessageEvent
  | RnSseErrorEvent
  | RnSseStateEvent
  | RnSseCloseEvent;

/**
 * Configuration for `RnSseConnection`.
 */
export interface RnSseConnectionOptions {
  /** URL of the stdio-to-sse HTTP endpoint. */
  url: string;
  /** Optional HTTP headers (e.g. Authorization). */
  headers?: Record<string, string>;
  /** Optional POST body sent once when the SSE connection is opened. */
  body?: string;
  /**
   * Interval in milliseconds to expect any SSE traffic before considering the
   * connection stale and triggering a reconnect (default: `60000`).
   */
  heartbeatTimeout?: number;
  /**
   * Interval in milliseconds between reconnection attempts when the connection
   * drops unexpectedly (default: `1000`).
   */
  reconnectDelay?: number;
  /** Maximum reconnection delay in milliseconds (default: `30000`). */
  maxReconnectDelay?: number;
  /** Maximum number of consecutive reconnection attempts (default: `10`). */
  maxReconnectAttempts?: number;
  /**
   * Jitter factor applied to reconnect delays (default: `0.25`).
   * A delay of 1000ms with jitter 0.25 becomes a random value between
   * 750ms and 1250ms.
   */
  jitter?: number;
}
