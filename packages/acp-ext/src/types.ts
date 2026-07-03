/**
 * ACP Extension protocol (`_agent/*`) type definitions.
 *
 * These types define a non-standard extension to ACP v1 for managing multiple
 * agents on a gateway. All method names use the `_agent/` prefix to clearly
 * distinguish them from standard ACP methods. The gateway intercepts `_`-prefixed
 * methods in `/send` requests and handles them itself — the agent process never
 * sees them.
 */

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

/** A single agent definition that the gateway can spawn. */
export interface AgentConfig {
  /** Unique identifier (e.g. "kimi", "codex"). */
  id: string;
  /** Human-readable display name (e.g. "Kimi Code"). */
  name: string;
  /** Executable command (e.g. "kimi", "npx"). */
  command: string;
  /** Arguments passed to the command. */
  args: string[];
  /** Working directory for the spawned process. */
  cwd?: string;
}

// ---------------------------------------------------------------------------
// _agent/list
// ---------------------------------------------------------------------------

export interface AgentListResult {
  agents: AgentConfig[];
  /** The agent currently running (or being spawned) on the gateway. */
  currentAgentId: string | null;
}

// ---------------------------------------------------------------------------
// _agent/get
// ---------------------------------------------------------------------------

export interface AgentGetParams {
  agentId: string;
}

export interface AgentGetResult {
  agent: AgentConfig;
}

// ---------------------------------------------------------------------------
// _agent/create
// ---------------------------------------------------------------------------

export interface AgentCreateParams {
  agent: Omit<AgentConfig, "id"> & { id?: string };
}

export interface AgentCreateResult {
  agent: AgentConfig;
}

// ---------------------------------------------------------------------------
// _agent/update
// ---------------------------------------------------------------------------

export interface AgentUpdateParams {
  agent: AgentConfig;
}

export interface AgentUpdateResult {
  agent: AgentConfig;
}

// ---------------------------------------------------------------------------
// _agent/delete
// ---------------------------------------------------------------------------

export interface AgentDeleteParams {
  agentId: string;
}

// ---------------------------------------------------------------------------
// _agent/switch
// ---------------------------------------------------------------------------

export interface AgentSwitchParams {
  agentId: string;
}

export interface AgentSwitchResult {
  agentId: string;
}

// ---------------------------------------------------------------------------
// _agent/reload
// ---------------------------------------------------------------------------

export interface AgentReloadResult {
  agentId: string;
}

// ---------------------------------------------------------------------------
// _agent/current
// ---------------------------------------------------------------------------

export interface AgentCurrentResult {
  agentId: string | null;
}

// ---------------------------------------------------------------------------
// _agent/changed notification
// ---------------------------------------------------------------------------

/** Broadcast to all SSE connections when the agent list or current agent changes. */
export interface AgentChangedNotification {
  agents: AgentConfig[];
  currentAgentId: string | null;
}

// ---------------------------------------------------------------------------
// Method / notification names
// ---------------------------------------------------------------------------

export const AcpExtMethod = {
  AgentList: "_agent/list",
  AgentGet: "_agent/get",
  AgentCreate: "_agent/create",
  AgentUpdate: "_agent/update",
  AgentDelete: "_agent/delete",
  AgentSwitch: "_agent/switch",
  AgentReload: "_agent/reload",
  AgentCurrent: "_agent/current",
} as const;

export const AcpExtNotification = {
  AgentChanged: "_agent/changed",
} as const;

/**
 * Check whether a JSON-RPC method name is an ACP extension method
 * (i.e. starts with `_`). The gateway uses this to decide whether to
 * handle a request itself or forward it to the agent process stdin.
 */
export function isExtMethod(method: string): boolean {
  return method.startsWith("_");
}
