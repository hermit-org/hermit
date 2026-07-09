import { create } from "zustand";
import type { AcpClient } from "@hermit-org/acp";
import type { AgentConfig } from "@hermit-org/acp-ext";

/**
 * Shared store that exposes the RealApp's live `AcpClient` to other parts of
 * the UI (e.g. the settings page's AgentsSection) without creating a second
 * SSE connection.
 *
 * RealApp registers its client + connection state on mount; consumers read from
 * the store instead of calling `useAcpClient` themselves.
 *
 * D2: Agent ext data (agents list, currentAgentId, switching state, and the
 * mutation callbacks) is also registered here so AgentsSection doesn't need to
 * call `useAcpExt` a second time (which would duplicate `_agent/list` requests
 * and `_agent/changed` subscriptions).
 */
interface AcpClientStoreState {
  /** The live AcpClient from RealApp, or null when no gateway is active. */
  client: AcpClient | null;
  /** Raw transport state from `useAcpClient.state` (e.g. "connecting"). */
  connectionState: string;
  /** Whether the transport (SSE) is connected. */
  transportReady: boolean;
  /** Register the RealApp client. Called by RealApp on every render/effect. */
  setClient: (client: AcpClient | null) => void;
  /** Update the transport connection state. */
  setConnectionState: (state: string) => void;

  // ── Agent ext data (registered by RealApp, consumed by AgentsSection) ──
  /** All configured agents from the gateway. */
  extAgents: AgentConfig[];
  /** Currently active agent id. */
  extCurrentAgentId: string | null;
  /** Whether the agent list is loading. */
  extLoading: boolean;
  /** Error from the last ext operation. */
  extError: string | null;
  /** Whether a switch/reload is in progress. */
  extSwitching: boolean;
  /** Create a new agent. */
  extCreateAgent: ((agent: Omit<AgentConfig, "id"> & { id?: string }) => Promise<void>) | null;
  /** Update an existing agent. */
  extUpdateAgent: ((agent: AgentConfig) => Promise<void>) | null;
  /** Delete an agent. */
  extDeleteAgent: ((agentId: string) => Promise<void>) | null;
  /** Switch to a different agent. */
  extSwitchAgent: ((agentId: string) => Promise<void>) | null;
  /** Reload the current agent. */
  extReloadAgent: (() => Promise<void>) | null;
  /** Refresh the agent list. */
  extRefresh: (() => Promise<void>) | null;
  /** Register agent ext data from RealApp. */
  setExtData: (data: {
    agents: AgentConfig[];
    currentAgentId: string | null;
    loading: boolean;
    error: string | null;
    switching: boolean;
    createAgent: (agent: Omit<AgentConfig, "id"> & { id?: string }) => Promise<void>;
    updateAgent: (agent: AgentConfig) => Promise<void>;
    deleteAgent: (agentId: string) => Promise<void>;
    switchAgent: (agentId: string) => Promise<void>;
    reloadAgent: () => Promise<void>;
    refresh: () => Promise<void>;
  }) => void;
}

export const useAcpClientStore = create<AcpClientStoreState>((set) => ({
  client: null,
  connectionState: "disconnected",
  transportReady: false,
  setClient: (client) => set({ client }),
  setConnectionState: (connectionState) =>
    set({
      connectionState,
      transportReady: connectionState === "connected",
    }),

  extAgents: [],
  extCurrentAgentId: null,
  extLoading: false,
  extError: null,
  extSwitching: false,
  extCreateAgent: null,
  extUpdateAgent: null,
  extDeleteAgent: null,
  extSwitchAgent: null,
  extReloadAgent: null,
  extRefresh: null,
  setExtData: (data) =>
    set({
      extAgents: data.agents,
      extCurrentAgentId: data.currentAgentId,
      extLoading: data.loading,
      extError: data.error,
      extSwitching: data.switching,
      extCreateAgent: data.createAgent,
      extUpdateAgent: data.updateAgent,
      extDeleteAgent: data.deleteAgent,
      extSwitchAgent: data.switchAgent,
      extReloadAgent: data.reloadAgent,
      extRefresh: data.refresh,
    }),
}));
