/**
 * React hook for the ACP extension (`_agent/*`) protocol.
 *
 * Wraps the typed `AcpExtClient` in React state, automatically refreshing the
 * agent list when an `_agent/changed` notification arrives from the gateway.
 *
 * The hook only activates once the transport (SSE) is connected — it does NOT
 * wait for the full ACP `initialize` handshake. This means `_agent/list` can
 * be served by the gateway while the agent process is still starting up,
 * making the agent switcher UI available immediately.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAcpExtClient,
  type AgentConfig,
  type AgentChangedNotification,
  type AcpExtClient,
} from "@hermit-org/acp-ext";
import { AcpExtNotification } from "@hermit-org/acp-ext";
import type { AcpClient } from "@hermit-org/acp";

export interface UseAcpExtResult {
  /** All configured agents. */
  agents: AgentConfig[];
  /** The currently active agent id (null if no agent is running). */
  currentAgentId: string | null;
  /** Whether the initial agent list is loading. */
  loading: boolean;
  /** Error from the last failed operation, if any. */
  error: string | null;
  /** Typed extension client for direct method calls. */
  ext: AcpExtClient | null;
  /** Refresh the agent list from the gateway. */
  refresh: () => Promise<void>;
  /** Create a new agent. */
  createAgent: (agent: Omit<AgentConfig, "id"> & { id?: string }) => Promise<void>;
  /** Update an existing agent. */
  updateAgent: (agent: AgentConfig) => Promise<void>;
  /** Delete an agent. */
  deleteAgent: (agentId: string) => Promise<void>;
  /** Switch to a different agent. */
  switchAgent: (agentId: string) => Promise<void>;
  /** Reload (restart) the current agent. */
  reloadAgent: () => Promise<void>;
}

/**
 * Manage agents via the `_agent/*` extension protocol on top of an existing
 * `AcpClient` connection. Pass `enabled = false` to skip all work when the
 * feature flag is off.
 *
 * `transportReady` should be true once the SSE transport is connected (but NOT
 * necessarily once `initialize` completes — the gateway can handle `_agent/*`
 * requests before the agent process is ready).
 */
export function useAcpExt(
  client: AcpClient | null,
  enabled: boolean,
  transportReady: boolean,
): UseAcpExtResult {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const extRef = useRef<AcpExtClient | null>(null);

  // Build the typed extension client whenever the underlying AcpClient changes
  // AND the transport is ready. We gate on `transportReady` because
  // `client.request()` writes to the transport — calling it before the SSE
  // stream is open would throw.
  useEffect(() => {
    if (!client || !enabled || !transportReady) {
      extRef.current = null;
      setAgents([]);
      setCurrentAgentId(null);
      return;
    }

    const ext = createAcpExtClient(client);
    extRef.current = ext;

    // Subscribe to `_agent/changed` notifications.
    const unsub = client.onNotification((method, params) => {
      if (method !== AcpExtNotification.AgentChanged) return;
      const p = params as AgentChangedNotification;
      setAgents(p.agents);
      setCurrentAgentId(p.currentAgentId);
    });

    // Fetch the initial list.
    setLoading(true);
    setError(null);
    ext
      .agentList()
      .then((result) => {
        setAgents(result.agents);
        setCurrentAgentId(result.currentAgentId);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));

    return () => {
      unsub();
      extRef.current = null;
    };
  }, [client, enabled, transportReady]);

  const refresh = useCallback(async () => {
    if (!extRef.current) return;
    try {
      const result = await extRef.current.agentList();
      setAgents(result.agents);
      setCurrentAgentId(result.currentAgentId);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const createAgent = useCallback(
    async (agent: Omit<AgentConfig, "id"> & { id?: string }) => {
      if (!extRef.current) return;
      await extRef.current.agentCreate(agent);
    },
    [],
  );

  const updateAgent = useCallback(async (agent: AgentConfig) => {
    if (!extRef.current) return;
    await extRef.current.agentUpdate(agent);
  }, []);

  const deleteAgent = useCallback(async (agentId: string) => {
    if (!extRef.current) return;
    await extRef.current.agentDelete(agentId);
  }, []);

  const switchAgent = useCallback(async (agentId: string) => {
    if (!extRef.current) return;
    await extRef.current.agentSwitch(agentId);
  }, []);

  const reloadAgent = useCallback(async () => {
    if (!extRef.current) return;
    await extRef.current.agentReload();
  }, []);

  return {
    agents,
    currentAgentId,
    loading,
    error,
    ext: extRef.current,
    refresh,
    createAgent,
    updateAgent,
    deleteAgent,
    switchAgent,
    reloadAgent,
  };
}
