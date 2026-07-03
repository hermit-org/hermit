/**
 * ACP Extension client helpers.
 *
 * The extension methods (`_agent/*`) ride on the same JSON-RPC transport as
 * standard ACP. This module provides typed helper functions that wrap the
 * lower-level `request` / `sendNotification` primitives exposed by `AcpClient`.
 *
 * Usage on the client side:
 *
 * ```ts
 * const ext = createAcpExtClient(acp.client);
 * const { agents, currentAgentId } = await ext.agentList();
 * ```
 */

import type {
  AgentListResult,
  AgentGetParams,
  AgentGetResult,
  AgentCreateParams,
  AgentCreateResult,
  AgentUpdateParams,
  AgentUpdateResult,
  AgentDeleteParams,
  AgentSwitchParams,
  AgentSwitchResult,
  AgentReloadResult,
  AgentCurrentResult,
  AgentConfig,
} from "./types";

/**
 * Minimal interface that the host `AcpClient` must satisfy for extension calls.
 * This is a subset of `AcpClient` — just the generic `request` method.
 */
export interface AcpExtTransport {
  /** Send a JSON-RPC request and await the typed response. */
  request<P, R>(method: string, params?: P): Promise<R>;
}

/** Typed wrapper for `_agent/*` extension calls. */
export interface AcpExtClient {
  /** List all configured agents and the currently active one. */
  agentList(): Promise<AgentListResult>;
  /** Get details of a single agent. */
  agentGet(agentId: string): Promise<AgentGetResult>;
  /** Create a new agent configuration. */
  agentCreate(agent: Omit<AgentConfig, "id"> & { id?: string }): Promise<AgentCreateResult>;
  /** Update an existing agent configuration. */
  agentUpdate(agent: AgentConfig): Promise<AgentUpdateResult>;
  /** Delete an agent configuration. */
  agentDelete(agentId: string): Promise<null>;
  /** Switch the gateway to a different agent (restarts the process). */
  agentSwitch(agentId: string): Promise<AgentSwitchResult>;
  /** Restart the currently active agent. */
  agentReload(): Promise<AgentReloadResult>;
  /** Get the currently active agent id. */
  agentCurrent(): Promise<AgentCurrentResult>;
}

/**
 * Create a typed ACP extension client backed by the given transport
 * (typically an `AcpClient` instance).
 */
export function createAcpExtClient(transport: AcpExtTransport): AcpExtClient {
  return {
    agentList: () =>
      transport.request<undefined, AgentListResult>("_agent/list"),

    agentGet: (agentId: string) =>
      transport.request<AgentGetParams, AgentGetResult>("_agent/get", { agentId }),

    agentCreate: (agent) =>
      transport.request<AgentCreateParams, AgentCreateResult>("_agent/create", { agent }),

    agentUpdate: (agent) =>
      transport.request<AgentUpdateParams, AgentUpdateResult>("_agent/update", { agent }),

    agentDelete: (agentId: string) =>
      transport.request<AgentDeleteParams, null>("_agent/delete", { agentId }),

    agentSwitch: (agentId: string) =>
      transport.request<AgentSwitchParams, AgentSwitchResult>("_agent/switch", { agentId }),

    agentReload: () =>
      transport.request<undefined, AgentReloadResult>("_agent/reload"),

    agentCurrent: () =>
      transport.request<undefined, AgentCurrentResult>("_agent/current"),
  };
}
