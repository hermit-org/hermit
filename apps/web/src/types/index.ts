/**
 * Hermit web app types.
 *
 * Mirrors the mobile app's domain model so both clients share the same shape.
 */

import type { ConfigOption } from "@hermit-org/acp";

export interface Gateway {
  id: string;
  name: string;
  url: string;
  sendUrl: string;
  token: string;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  gatewayId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** The agent-side ACP session ID, persisted so the conversation can be
   * resumed (via `session/resume`) instead of recreated on reconnect. */
  acpSessionId?: string;
  /** Agent-reported config options (model, mode, thinking, …). Persisted so
   * the status chips survive a reopen where `session/load` returns null. */
  configOptions?: ConfigOption[];
  /** True after `session/close` has been called on the agent side. */
  closed?: boolean;
}

export type MessageRole = "user" | "assistant" | "system";

/** An image attached to a pending draft, ready to be sent as an ACP image block. */
export interface PendingAttachment {
  /** Stable client-side id. */
  id: string;
  /** Original file name. */
  name: string;
  /** Image MIME type (e.g. `image/png`). */
  mimeType: string;
  /** Base64-encoded image data (no data-URL prefix). */
  data: string;
  /** Object URL or data URL used for the `<img>` preview. */
  previewUrl: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

// ACP / JSON-RPC 2.0

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: T;
}

export interface JsonRpcNotification<T = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: T;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

export interface AcpAgentInfo {
  name: string;
  version: string;
  capabilities?: string[];
}

/** A user-defined quick command / shortcut shown above the composer. */
export interface QuickCommand {
  /** Stable client-side id. */
  id: string;
  /** 2–8 character title shown on the chip. */
  title: string;
  /** Up to 1000 characters inserted into the composer. */
  content: string;
  /** Whether this shortcut is currently active. */
  enabled: boolean;
}
