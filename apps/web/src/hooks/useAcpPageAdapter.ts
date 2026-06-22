/**
 * Adapter that bridges the legacy ACP runtime (`useAcpClient` + the Zustand
 * stores in `src/stores`) to the new Atomic-Design UI's prop contract
 * (`ACPClientPageProps`).
 *
 * It is intentionally a *read* adapter plus a set of action callbacks: it does
 * not import or modify any component under `src/components` or `src/pages`.
 * All new-UI components remain driven purely by props.
 *
 * Responsibilities:
 *  - Map the active gateway's connection/auth state to UI props.
 *  - Map persisted sessions to `SessionSummary[]` and keep an "active" one.
 *  - Drive the active session's lifecycle (new / load / resume) against the
 *    real `AcpClient`.
 *  - Subscribe to `session/update` and fold streaming message chunks, tool
 *    calls, plans and usage into the `ChatItem[]` / `ToolCallState[]` shapes
 *    the `ChatArea` and `ToolCallPanel` expect.
 *  - Map the permission store's pending requests (which carry resolve/
 *    reject promise callbacks) to the plain-data `domain.PendingPermission`
 *    shape and wire `onResolvePermission` back to the store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AcpClient,
  AvailableCommand,
  ConfigOption,
  ContentBlock,
  PlanEntry,
  SessionInfo,
  SessionMode,
  SessionModeState,
  SessionSetupResult,
  SessionUpdate,
  UsageUpdate,
} from "@hermit-org/acp";

import { useAcpClient } from "../acp/hooks";
import { useGatewayStore } from "../stores/gatewayStore";
import { useSessionStore } from "../stores/sessionStore";
import { usePermissionStore } from "../stores/permissionStore";
import type { Gateway, Session } from "../types";

import type {
  ChatItem,
} from "../components/organisms/chat-area";
import type {
  ConnectionStatus,
  PendingPermission,
  ToolCallState,
  UsageStats,
  AnsweredPermissionView,
} from "../components/domain";
import { mergeToolCall } from "../components/domain";
import type { SessionSummary } from "../components/organisms/session-sidebar";

/** A live, in-flight turn: streaming items + tool-call index + meta. */
interface LiveTurn {
  items: ChatItem[];
  toolCalls: Map<string, ToolCallState>;
}

const EMPTY_TURN: LiveTurn = {
  items: [],
  toolCalls: new Map(),
};

/** Agent-reported session meta that survives across turns. */
interface SessionMeta {
  modes: SessionModeState | null;
  commands: AvailableCommand[];
  agentName: string | null;
}

const EMPTY_META: SessionMeta = {
  modes: null,
  commands: [],
  agentName: null,
};

/** Map the transport state string to the UI's ConnectionStatus union. */
function mapConnectionState(state: string, connected: boolean): ConnectionStatus {
  if (state === "error") return "error";
  if (connected) return "connected";
  if (state === "connecting") return "connecting";
  if (state === "negotiating") return "negotiating";
  return "disconnected";
}

/** Reduce a ContentBlock to plain text for the transcript bubble. */
function contentToText(content: ContentBlock): string {
  if (content.type === "text") return content.text;
  if (content.type === "resource_link") return content.name;
  if (content.type === "resource") {
    const r = content.resource;
    return "text" in r ? r.text : `[resource ${r.uri}]`;
  }
  // Non-text content (image/audio) isn't part of the plain-text transcript.
  return "";
}

export interface UseAcpPageAdapterResult {
  /** Props ready to spread onto <ACPClientPage />. */
  connectionStatus: ConnectionStatus;
  requireAuth: boolean;
  protocolVersion: string;
  agentName: string;
  /** Agent-reported capability badges derived from `initialize`. */
  capabilities: string[];
  /** Whether the transport reports an authenticated session. */
  authenticated: boolean;
  /** Whether the agent supports `logout`. */
  canLogout: boolean;
  /** Negotiated operating modes (may be empty until a session is set up). */
  modes: SessionMode[];
  /** Current operating mode id. */
  currentModeId?: string;
  /** Agent-reported config options (model / mode / thinking …). */
  configOptions: ConfigOption[];
  sessions: SessionSummary[];
  activeSessionId: string | null;
  chatItems: ChatItem[];
  toolCalls: ToolCallState[];
  commands: AvailableCommand[];
  busy: boolean;
  usage: UsageStats | undefined;
  permissions: PendingPermission[];
  draft: string;
  /** Auth method ids advertised by the agent. */
  authMethods: { id: string; name: string; description?: string }[];
  /** Runtime / setup error to surface. */
  error: string | null;
  /** Current session plan / todo. */
  plan: PlanEntry[];
  /** Number of prompts queued behind the in-flight turn. */
  queueDepth: number;
  /** Previously-answered permission requests (newest first). */
  permissionHistory: AnsweredPermissionView[];

  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onModeChange: (modeId: string) => void;
  onDraftChange: (value: string) => void;
  onPrompt: (value: string) => void;
  onCancel: () => void;
  onCloseSession: () => void;
  onConfigChange: (optionId: string, value: string) => void;
  onResolvePermission: (
    request: PendingPermission,
    outcome: string | "cancelled",
  ) => void;
  onAuthenticate: (methodId: string, _apiKey: string) => void;
  onLogout: () => void;
  onReconnect: () => void;
  onDismissError: () => void;
}

/**
 * Drive the new UI from the legacy runtime for a single gateway.
 *
 * @param gateway The gateway to connect to. Pass `null` when none is
 * configured (the adapter then reports `disconnected` and an empty session
 * list).
 */
export function useAcpPageAdapter(
  gateway: Gateway | null,
): UseAcpPageAdapterResult {
  const acp = useAcpClient({ gateway, autoConnect: true });

  const sessions = useSessionStore((s) => s.sessions);
  const messages = useSessionStore((s) => s.messages);
  const createSession = useSessionStore((s) => s.createSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const activeSessionIdStore = useSessionStore((s) => s.activeSessionId);
  const setSessionAcpId = useSessionStore((s) => s.setSessionAcpId);
  const setSessionConfig = useSessionStore((s) => s.setSessionConfig);
  const setSessionTitle = useSessionStore((s) => s.setSessionTitle);
  const setSessionClosed = useSessionStore((s) => s.setSessionClosed);
  const setMessages = useSessionStore((s) => s.setMessages);

  const pendingPermissions = usePermissionStore((s) => s.pending);
  const permissionHistoryStore = usePermissionStore((s) => s.history);

  // ---- local view state -------------------------------------------------
  const [draft, setDraft] = useState("");
  const [liveTurn, setLiveTurn] = useState<LiveTurn>(EMPTY_TURN);
  const [meta, setMeta] = useState<SessionMeta>(EMPTY_META);
  const [busy, setBusy] = useState(false);
  const [acpSessionId, setAcpSessionId] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [configOptions, setConfigOptions] = useState<ConfigOption[]>([]);
  const [agentSessions, setAgentSessions] = useState<SessionInfo[]>([]);
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // While replaying history via `session/load`, message chunks are diverted
  // into this buffer instead of the live turn — the agent's record is
  // authoritative and gets flushed to the store once the replay completes.
  const isLoadingHistoryRef = useRef(false);
  const historyBufferRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  // Surface runtime/session-setup errors to the console. The new UI's
  // `ACPClientPage` does not (yet) accept an error prop, so we cannot route
  // these into a visible banner without modifying component code; logging
  // keeps them observable instead of silently swallowed.
  useEffect(() => {
    if (setupError) console.error("[ACP adapter]", setupError);
  }, [setupError]);

  const clientRef = useRef<AcpClient | null>(null);
  // Mirror the latest `client` from the hook into a ref so async callbacks
  // (send / cancel) always read the current value.
  useEffect(() => {
    clientRef.current = acp.client;
  }, [acp.client]);

  // Mirror the live turn into a ref so the `onPrompt` callback (which is
  // memoised on session id, not turn state) can read the *current* items
  // when the prompt promise resolves — by then streaming has populated it.
  const liveTurnRef = useRef<LiveTurn>(EMPTY_TURN);
  useEffect(() => {
    liveTurnRef.current = liveTurn;
  }, [liveTurn]);

  // Keep the active local session scoped to this gateway.
  const gatewaySessions = useMemo(
    () => sessions.filter((s) => s.gatewayId === gateway?.id),
    [sessions, gateway?.id],
  );

  const activeSessionId = useMemo(() => {
    if (!gateway) return null;
    if (
      activeSessionIdStore &&
      gatewaySessions.some((s) => s.id === activeSessionIdStore)
    ) {
      return activeSessionIdStore;
    }
    return gatewaySessions[0]?.id ?? null;
  }, [gateway, activeSessionIdStore, gatewaySessions]);

  const activeSession: Session | undefined = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );

  // Persisted message history for the active session (rendered before the
  // live turn so streaming output appears below the conversation so far).
  const historyItems: ChatItem[] = useMemo(() => {
    if (!activeSessionId) return [];
    return messages
      .filter((m) => m.sessionId === activeSessionId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map<ChatItem>((m) => ({
        kind: "message",
        key: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));
  }, [messages, activeSessionId]);

  const chatItems: ChatItem[] = useMemo(
    () => [...historyItems, ...liveTurn.items],
    [historyItems, liveTurn.items],
  );

  const toolCalls: ToolCallState[] = useMemo(
    () => Array.from(liveTurn.toolCalls.values()),
    [liveTurn.toolCalls],
  );

  // Latest usage update for the status bar.
  const [usage, setUsage] = useState<UsageStats | undefined>(undefined);

  // ---- session/update reducer ------------------------------------------
  const applyUpdate = useCallback(
    (update: SessionUpdate) => {
      switch (update.sessionUpdate) {
        case "agent_message_chunk":
        case "user_message_chunk": {
          const role =
            update.sessionUpdate === "agent_message_chunk"
              ? "assistant"
              : "user";
          const text = contentToText(update.content);
          if (!text) break;
          // While replaying the agent's history via `session/load`, divert
          // message chunks into the history buffer instead of the live turn —
          // the agent's record is authoritative and gets flushed to the store
          // once the replay completes.
          if (isLoadingHistoryRef.current) {
            const buf = historyBufferRef.current;
            const last = buf[buf.length - 1];
            if (last && last.role === role) {
              last.content += text;
            } else {
              buf.push({ role, content: text });
            }
            break;
          }
          setLiveTurn((prev) => {
            const items = [...prev.items];
            const last = items[items.length - 1];
            if (last && last.kind === "message" && last.role === role) {
              items[items.length - 1] = {
                ...last,
                content: last.content + text,
                streaming: true,
              };
            } else {
              items.push({
                kind: "message",
                key: update.messageId ?? `m_${Date.now()}_${items.length}`,
                role,
                content: text,
                streaming: true,
                createdAt: Date.now(),
              });
            }
            return { ...prev, items };
          });
          break;
        }
        case "tool_call":
        case "tool_call_update": {
          setLiveTurn((prev) => {
            const existing = prev.toolCalls.get(update.toolCallId);
            const merged = mergeToolCall(existing, update);
            const toolCalls = new Map(prev.toolCalls);
            toolCalls.set(update.toolCallId, merged);
            const items = [...prev.items];
            const idx = items.findIndex(
              (it) =>
                it.kind === "tool_call" &&
                it.call.toolCallId === update.toolCallId,
            );
            const card = { kind: "tool_call" as const, key: update.toolCallId, call: merged };
            if (idx >= 0) items[idx] = card;
            else items.push(card);
            return { ...prev, items, toolCalls };
          });
          break;
        }
        case "agent_thought_chunk": {
          const text = contentToText(update.content);
          if (!text) break;
          setLiveTurn((prev) => {
            const items = [...prev.items];
            const last = items[items.length - 1];
            if (last && last.kind === "thought") {
              items[items.length - 1] = {
                ...last,
                content: last.content + text,
                streaming: true,
              };
            } else {
              items.push({
                kind: "thought",
                key: `th_${Date.now()}_${items.length}`,
                content: text,
                streaming: true,
              });
            }
            return { ...prev, items };
          });
          break;
        }
        case "usage_update": {
          const u = update as UsageUpdate;
          setUsage({
            used: u.used,
            size: u.size,
            cost: u.cost
              ? { amount: u.cost.amount, currency: u.cost.currency }
              : undefined,
          });
          break;
        }
        case "current_mode_update": {
          setMeta((m) => {
            if (!m.modes) {
              return {
                ...m,
                modes: {
                  currentModeId: update.modeId,
                  availableModes: [{ id: update.modeId, name: update.modeId }],
                },
              };
            }
            return { ...m, modes: { ...m.modes, currentModeId: update.modeId } };
          });
          break;
        }
        case "available_commands_update": {
          setMeta((m) => ({ ...m, commands: update.availableCommands }));
          break;
        }
        case "session_info_update": {
          if (update.title && activeSessionId) {
            setSessionTitle(activeSessionId, update.title);
          }
          break;
        }
        case "plan": {
          setPlan(update.entries);
          break;
        }
        case "agent_thought_chunk":
        default:
          // Plans/thoughts are not first-class in the current new-UI props;
          // ignore them rather than risk a malformed ChatItem.
          break;
      }
    },
    [activeSessionId, setSessionTitle],
  );

  // Subscribe to session/update while connected.
  useEffect(() => {
    if (!acp.client) return;
    const unsubscribe = acp.client.onUpdate(applyUpdate);
    return unsubscribe;
  }, [acp.client, applyUpdate]);

  // ---- establish / resume the active session ---------------------------
  useEffect(() => {
    if (!gateway || !acp.client || !acp.connected || !activeSessionId) return;
    if (acpSessionId) return;
    let cancelled = false;

    void (async () => {
      const client = clientRef.current;
      if (!client) return;
      const caps = client.initializeResult?.agentCapabilities;
      const supportsLoad = caps?.loadSession === true;
      const supportsResume = !!caps?.sessionCapabilities?.resume;
      const storedAcpId = activeSession?.acpSessionId;
      const shouldRestore = storedAcpId && (supportsLoad || supportsResume);

      try {
        let result: Pick<SessionSetupResult, "sessionId" | "modes" | "configOptions">;
        if (shouldRestore && supportsLoad) {
          // The agent replays the full conversation history over
          // session/update. Treat that record as authoritative: discard the
          // local cache and rebuild it from the replay.
          historyBufferRef.current = [];
          isLoadingHistoryRef.current = true;
          try {
            await client.sessionLoad({ sessionId: storedAcpId as string, cwd: "/" });
          } finally {
            isLoadingHistoryRef.current = false;
          }
          // Flush the replayed history into the store (replacing any prior
          // local copy) so it survives a re-open or a subsequent prompt.
          const replayed = historyBufferRef.current;
          historyBufferRef.current = [];
          if (replayed.length > 0) {
            setMessages(activeSessionId, replayed);
          }
          result = { sessionId: storedAcpId as string };
        } else if (shouldRestore && supportsResume) {
          result = await client.sessionResume({
            sessionId: storedAcpId as string,
            cwd: "/",
          });
        } else {
          result = await client.sessionNew({ cwd: "/" });
        }
        if (cancelled) return;
        setAcpSessionId(result.sessionId);
        setSessionAcpId(activeSessionId, result.sessionId);
        if (result.modes) setMeta((m) => ({ ...m, modes: result.modes ?? null }));
        if (result.configOptions) {
          setConfigOptions(result.configOptions);
          setSessionConfig(activeSessionId, result.configOptions);
        } else if (activeSession?.configOptions) {
          // Restore persisted config options when the agent did not return any.
          setConfigOptions(activeSession.configOptions);
        }
        const info = client.initializeResult?.agentInfo ?? null;
        if (info) setMeta((m) => ({ ...m, agentName: info.title ?? info.name }));
        setSetupError(null);
      } catch (e) {
        if (cancelled) return;
        // Fall back to a fresh session if restore failed.
        if (shouldRestore) {
          try {
            const fresh = await clientRef.current!.sessionNew({ cwd: "/" });
            if (cancelled) return;
            setAcpSessionId(fresh.sessionId);
            setSessionAcpId(activeSessionId, fresh.sessionId);
            if (fresh.modes) setMeta((m) => ({ ...m, modes: fresh.modes ?? null }));
            if (fresh.configOptions) {
              setConfigOptions(fresh.configOptions);
              setSessionConfig(activeSessionId, fresh.configOptions);
            }
            setSetupError(null);
            return;
          } catch (e2) {
            setSetupError(e2 instanceof Error ? e2.message : String(e2));
            return;
          }
        }
        setSetupError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    gateway,
    acp.client,
    acp.connected,
    activeSessionId,
    activeSession?.acpSessionId,
    activeSession?.configOptions,
    acpSessionId,
    setSessionAcpId,
    setSessionConfig,
    setMessages,
  ]);

  // Reset live state when switching sessions.
  useEffect(() => {
    setLiveTurn(EMPTY_TURN);
    setBusy(false);
    setUsage(undefined);
    setAcpSessionId(null);
    setSetupError(null);
    setMeta(EMPTY_META);
    setConfigOptions(activeSession?.configOptions ?? []);
    setPlan([]);
    queueRef.current = [];
    setQueueDepth(0);
  }, [activeSessionId, activeSession?.configOptions]);

  // Auto-create a session when connected to a gateway with no sessions yet.
  // The legacy flow did this through the SessionListScreen's "New chat"
  // button; in the single-page new UI we create one automatically so the
  // user can start chatting immediately instead of seeing an empty canvas.
  useEffect(() => {
    if (!gateway || !acp.connected) return;
    if (gatewaySessions.length > 0) return;
    const s = createSession(gateway.id, "New chat");
    setActiveSession(s.id);
  }, [gateway, acp.connected, gatewaySessions.length, createSession, setActiveSession]);

  // Fetch the agent-side session list when the agent advertises the `list`
  // capability. These are the authoritative history (matching the legacy
  // SessionListScreen) and get merged into the sidebar below.
  const supportsList =
    acp.client?.initializeResult?.agentCapabilities?.sessionCapabilities?.list !=
    null;
  useEffect(() => {
    if (!acp.client || !acp.connected || !supportsList) return;
    let cancelled = false;
    acp.client
      .sessionList()
      .then((res) => {
        if (!cancelled) setAgentSessions(res.sessions);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setSetupError(
            `session/list failed: ${e instanceof Error ? e.message : String(e)}`,
          );
      });
    return () => {
      cancelled = true;
    };
  }, [acp.client, acp.connected, supportsList]);

  // ---- actions ---------------------------------------------------------
  // Drain the prompt queue one turn at a time. Each question is sent as a
  // separate `session/prompt` turn and awaited before the next starts, so the
  // user can keep typing while a turn runs (mirrors the legacy pumpQueue).
  const pumpQueue = useCallback(async () => {
    if (processingRef.current) return;
    const client = clientRef.current;
    const sessionAcp = acpSessionId;
    if (!client || !sessionAcp || !activeSessionId) return;
    const next = queueRef.current.shift();
    if (next === undefined) return;

    processingRef.current = true;
    setBusy(true);
    setSetupError(null);
    setLiveTurn(EMPTY_TURN);
    useSessionStore.getState().addMessage(activeSessionId, "user", next);

    try {
      const prompt: ContentBlock[] = [{ type: "text", text: next }];
      await client.sessionPrompt({ sessionId: sessionAcp, prompt });
      const assistantText = liveTurnRef.current.items
        .filter(
          (it): it is Extract<ChatItem, { kind: "message" }> =>
            it.kind === "message" && it.role === "assistant",
        )
        .map((it) => it.content)
        .join("");
      if (assistantText) {
        useSessionStore
          .getState()
          .addMessage(activeSessionId, "assistant", assistantText);
      }
      setLiveTurn({ items: [], toolCalls: new Map() });
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : String(e));
    } finally {
      setQueueDepth((n) => Math.max(0, n - 1));
      processingRef.current = false;
      if (queueRef.current.length > 0) {
        void pumpQueue();
      } else {
        setBusy(false);
      }
    }
  }, [acpSessionId, activeSessionId]);

  const onPrompt = useCallback(
    (value: string) => {
      const text = value.trim();
      if (!text || !acpSessionId) return;
      setDraft("");
      queueRef.current.push(text);
      setQueueDepth((n) => n + 1);
      void pumpQueue();
    },
    [acpSessionId, pumpQueue],
  );

  const onCancel = useCallback(async () => {
    const client = clientRef.current;
    queueRef.current = [];
    setQueueDepth(0);
    if (!client || !acpSessionId) return;
    try {
      await client.sessionCancel({ sessionId: acpSessionId });
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : String(e));
    }
  }, [acpSessionId]);

  const onModeChange = useCallback(
    async (modeId: string) => {
      const client = clientRef.current;
      if (!client || !acpSessionId) return;
      try {
        await client.sessionSetMode({ sessionId: acpSessionId, modeId });
        setMeta((m) =>
          m.modes ? { ...m, modes: { ...m.modes, currentModeId: modeId } } : m,
        );
      } catch (e) {
        setSetupError(e instanceof Error ? e.message : String(e));
      }
    },
    [acpSessionId],
  );

  const onDraftChange = useCallback((value: string) => {
    setDraft(value);
  }, []);

  const onSelectSession = useCallback(
    (id: string) => {
      // Agent-side sessions are rendered with a synthetic `agent:` id prefix.
      // Selecting one creates (or reuses) a local session linked to that ACP
      // session id so the session-setup effect can `session/load` / `resume`
      // it — mirroring the legacy SessionListScreen's `handleOpenAgent`.
      if (id.startsWith("agent:")) {
        const acpId = id.slice("agent:".length);
        if (!gateway) return;
        const existing = sessions.find((s) => s.acpSessionId === acpId);
        if (existing) {
          setActiveSession(existing.id);
          return;
        }
        const info = agentSessions.find((s) => s.sessionId === acpId);
        const s = createSession(
          gateway.id,
          info?.title ?? "Agent session",
          acpId,
        );
        setActiveSession(s.id);
        return;
      }
      setActiveSession(id);
    },
    [gateway, sessions, agentSessions, createSession, setActiveSession],
  );

  const onCreateSession = useCallback(() => {
    if (!gateway) return;
    const s = createSession(gateway.id);
    setActiveSession(s.id);
  }, [gateway, createSession, setActiveSession]);

  const onResolvePermission = useCallback(
    (request: PendingPermission, outcome: string | "cancelled") => {
      const store = usePermissionStore.getState();
      if (outcome === "cancelled") {
        store.cancel(request.id);
      } else {
        store.respond(request.id, outcome);
      }
    },
    [],
  );

  const onAuthenticate = useCallback(
    (methodId: string) => {
      void acp.authenticate(methodId);
    },
    [acp],
  );

  const onLogout = useCallback(() => {
    void acp.logout();
  }, [acp]);

  // Change an agent config option (model / mode / thinking …) via
  // `session/set_config_option`. Updates local state optimistically and
  // refreshes from the response if the agent returns the updated option.
  const onConfigChange = useCallback(
    async (optionId: string, value: string) => {
      const client = clientRef.current;
      if (!client || !acpSessionId || !activeSessionId) return;
      const prev = configOptions;
      // Optimistic update so the chip reflects the change immediately.
      const optimistic = prev.map((o) =>
        o.id === optionId ? { ...o, currentValue: value } : o,
      );
      setConfigOptions(optimistic);
      setSessionConfig(activeSessionId, optimistic);
      try {
        const result = await client.sessionSetConfigOption({
          sessionId: acpSessionId,
          id: optionId,
          value,
        });
        if (result.configOption) {
          const next = prev.map((o) =>
            o.id === result.configOption!.id ? result.configOption! : o,
          );
          setConfigOptions(next);
          setSessionConfig(activeSessionId, next);
        }
      } catch (e) {
        // Revert optimistic update on failure.
        console.error("[ACP adapter] set_config_option failed:", e);
        setConfigOptions(prev);
        setSessionConfig(activeSessionId, prev);
      }
    },
    [acpSessionId, activeSessionId, configOptions, setSessionConfig],
  );

  // Close the agent-side session via `session/close`.
  const onCloseSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !acpSessionId || !activeSessionId) return;
    if (!window.confirm("Close this session on the agent?")) return;
    try {
      await client.sessionClose({ sessionId: acpSessionId });
      setSessionClosed(activeSessionId, true);
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : String(e));
    }
  }, [acpSessionId, activeSessionId, setSessionClosed]);

  // Delete a local session and, when possible, its agent-side counterpart.
  const onDeleteSession = useCallback(
    async (id: string) => {
      const client = clientRef.current;
      const supportsDelete =
        client?.initializeResult?.agentCapabilities?.sessionCapabilities
          ?.delete != null;
      // Agent-side sessions are rendered with a synthetic `agent:` prefix.
      let acpId: string | undefined;
      let localId: string | undefined;
      if (id.startsWith("agent:")) {
        acpId = id.slice("agent:".length);
        localId = sessions.find((s) => s.acpSessionId === acpId)?.id;
      } else {
        const local = sessions.find((s) => s.id === id);
        localId = id;
        acpId = local?.acpSessionId;
      }
      if (acpId && supportsDelete && client) {
        if (!window.confirm("Delete this session?")) return;
      }
      if (localId) deleteSession(localId);
      if (acpId && supportsDelete && client) {
        try {
          await client.sessionDelete({ sessionId: acpId });
          setAgentSessions((prev) =>
            prev.filter((s) => s.sessionId !== acpId),
          );
        } catch (e) {
          setSetupError(
            `session/delete failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    },
    [sessions, deleteSession],
  );

  // ---- map legacy state -> UI props ------------------------------------
  // Merge local sessions with agent-side sessions. An agent session that is
  // already linked to a local session updates the local entry's title/
  // timestamp; unlinked agent sessions appear as their own sidebar rows so the
  // user can reopen prior conversations (matching the legacy SessionListScreen).
  const agentSessionIds = new Set(agentSessions.map((s) => s.sessionId));
  const localOnlySessions = gatewaySessions.filter(
    (s) => !s.acpSessionId || !agentSessionIds.has(s.acpSessionId),
  );
  const sessionSummaries: SessionSummary[] = useMemo(() => {
    const fromAgent: SessionSummary[] = agentSessions.map((info) => {
      const linked = gatewaySessions.find(
        (s) => s.acpSessionId === info.sessionId,
      );
      return {
        id: linked?.id ?? `agent:${info.sessionId}`,
        title:
          linked?.title ?? info.title ?? info.sessionId.slice(0, 12),
        updatedAt: linked?.updatedAt ?? info.updatedAt ?? Date.now(),
        closed: linked?.closed,
      };
    });
    const fromLocal: SessionSummary[] = localOnlySessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      closed: s.closed,
    }));
    // De-dup by id, preferring agent-linked entries, and sort newest first.
    const seen = new Set<string>();
    const merged = [...fromAgent, ...fromLocal].filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return merged.sort(
      (a, b) =>
        Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0),
    );
  }, [agentSessions, gatewaySessions, localOnlySessions]);

  const permissionsUi: PendingPermission[] = useMemo(
    () =>
      pendingPermissions.map<PendingPermission>((p) => ({
        id: p.id,
        sessionId: activeSessionId ?? "",
        toolCall: p.toolCall,
        options: p.options,
        createdAt: p.createdAt,
      })),
    [pendingPermissions, activeSessionId],
  );

  // The legacy authenticate() takes only a methodId; the API-key value is
  // supplied out-of-band by agents that need it, so we ignore the key here.

  const connectionStatus = mapConnectionState(acp.state, acp.connected);
  const requireAuth =
    acp.connected &&
    acp.authMethods.length > 0 &&
    !acp.authenticated;
  const protocolVersion =
    acp.client?.initializeResult?.protocolVersion != null
      ? String(acp.client.initializeResult.protocolVersion)
      : "1";
  const agentName =
    meta.agentName ??
    acp.client?.initializeResult?.agentInfo?.title ??
    acp.client?.initializeResult?.agentInfo?.name ??
    gateway?.name ??
    "ACP Agent";

  // Derive capability badges from the real `initialize` result instead of
  // the hardcoded mock list the page used before.
  const capabilities = useMemo(() => {
    const caps = acp.client?.initializeResult?.agentCapabilities;
    if (!caps) return [] as string[];
    const list: string[] = [];
    if (caps.loadSession) list.push("load");
    const sc = caps.sessionCapabilities;
    if (sc?.resume) list.push("resume");
    if (sc?.list) list.push("session.list");
    if (sc?.delete) list.push("session.delete");
    if (sc?.fork != null) list.push("fork");
    return list;
  }, [acp.client?.initializeResult?.agentCapabilities]);

  const modes = meta.modes?.availableModes ?? [];

  // Surface runtime/setup errors (setupError takes precedence over a raw
  // transport error). Mirrors the legacy ChatScreen's in-chat `⚠ error`.
  const error = setupError ?? (acp.error ? acp.error.message : null);

  // Map the permission store's answered history to the plain view-model.
  const permissionHistory = useMemo<AnsweredPermissionView[]>(
    () =>
      permissionHistoryStore.map((h) => ({
        id: h.toolCallId,
        question: h.question,
        answer: h.answer,
        note: h.note,
        at: h.at,
      })),
    [permissionHistoryStore],
  );

  const onReconnect = useCallback(() => {
    void acp.connect();
  }, [acp]);

  const onDismissError = useCallback(() => {
    setSetupError(null);
  }, []);

  // The new UI's ConnectionBar currently hard-codes its mode selector, so
  // there is no prop to forward the negotiated modes to yet. They are still
  // tracked in `meta.modes` and used to drive `onModeChange`.

  return {
    connectionStatus,
    requireAuth,
    protocolVersion,
    agentName,
    capabilities,
    authenticated: acp.authenticated,
    canLogout: acp.canLogout,
    modes,
    currentModeId: meta.modes?.currentModeId,
    configOptions,
    sessions: sessionSummaries,
    activeSessionId,
    chatItems,
    toolCalls,
    commands: meta.commands,
    busy,
    usage,
    permissions: permissionsUi,
    draft,
    authMethods: acp.authMethods.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    error,
    plan,
    queueDepth,
    permissionHistory,
    onSelectSession,
    onCreateSession,
    onModeChange,
    onDraftChange,
    onPrompt,
    onCancel,
    onCloseSession,
    onConfigChange,
    onDeleteSession,
    onResolvePermission,
    onAuthenticate,
    onLogout,
    onReconnect,
    onDismissError,
  };
}
