/**
 * Platform-agnostic types used by `@hermit-org/acp-hooks`.
 */

import type { AcpClient, AuthMethod, StdioTransport } from "@hermit-org/acp";

/**
 * A Hermit gateway. Mirrors the shape used by both web and mobile apps.
 */
export interface Gateway {
  id: string;
  name: string;
  url: string;
  sendUrl: string;
  token: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Platform-agnostic storage adapter. Implementations can be backed by
 * localStorage, MMKV, or any other key/value store.
 */
export interface StorageAdapter {
  getItem(name: string): string | null | Promise<string | null>;
  setItem(name: string, value: string): void | Promise<void>;
  removeItem(name: string): void | Promise<void>;
}

/**
 * Role of a chat message sender. Kept platform-agnostic so the same transcript
 * items can be rendered by web and mobile UIs.
 */
export type ChatRole = "user" | "assistant" | "system";

/**
 * Factory that creates a platform-specific `StdioTransport` for a gateway.
 */
export type CreateTransport = (gateway: Gateway) => StdioTransport;

/**
 * Platform-agnostic ACP client state consumed by `useAcpPageAdapter`.
 * Platforms provide this via their own transport-aware `useAcpClient` hook.
 */
export interface AcpClientState {
  client: AcpClient | null;
  connected: boolean;
  state: string;
  error: Error | null;
  authMethods: AuthMethod[];
  canLogout: boolean;
  authenticated: boolean;
  authenticate: (methodId: string) => Promise<void>;
  logout: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Optional callback used by `useAcpPageAdapter` to discover the agent's cwd
 * before calling lifecycle methods such as `session/new` or `session/load`.
 */
export type GetAgentCwd = (gateway: Gateway) => Promise<string>;
