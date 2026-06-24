/**
 * Adapter that bridges the ACP runtime (`useAcpClient`) to the UI's prop
 * contract (`ACPClientPageProps`).
 *
 * The agent (gateway) is the single source of truth for sessions and message
 * history. This adapter holds NO local session store — session lists come from
 * `session/list`, and message history is loaded on demand via `session/load`.
 * Only the active session's history is kept in ephemeral React state for
 * rendering; nothing is persisted to disk.
 *
 * Responsibilities:
 *  - Map the active gateway's connection/auth state to UI props.
 *  - Derive `SessionSummary[]` directly from the agent's `session/list`.
 *  - Drive the active session's lifecycle (new / load / resume) against the
 *    real `AcpClient`.
 *  - Subscribe to `session/update` and fold streaming message chunks, tool
 *    calls, plans and usage into the `ChatItem[]` / `ToolCallState[]` shapes
 *    the `ChatArea` and `ToolCallPanel` expect.
 *  - Map the permission store's pending requests to the plain-data
 *    `domain.PendingPermission` shape and wire `onResolvePermission` back.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AcpClient,
  AgentCapabilities,
  AvailableCommand,
  ConfigOption,
  ContentBlock,
  ImageContent,
  PlanEntry,
  SessionInfo,
  SessionMode,
  SessionModeState,
  SessionUpdate,
  UsageUpdate,
} from "@hermit-org/acp";

import { useAcpClient } from "../acp/hooks";
import { useGatewayStore } from "../stores/gatewayStore";
import { usePermissionStore } from "../stores/permissionStore";
import { useArchivedSessions } from "./useArchivedSessions";
import { useOpenSessions } from "./useOpenSessions";
import { useSettingsStore } from "../stores/settingsStore";
import { parseDuration, selectAutoArchiveIds } from "../lib/archive";
import type { Gateway, PendingAttachment } from "../types";

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

/** A queued prompt turn: the user's text plus any attached images. */
interface QueueItem {
  text: string;
  images: ImageContent[];
}

/** Maximum images that may be attached to a single prompt. */
const MAX_IMAGES = 4;

/** Read a File as base64 (without the data-URL prefix). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      // Strip the "data:<mime>;base64," prefix.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

/** Entries buffered while replaying history via `session/load`. */
type HistoryBufferEntry =
  | { kind: "message"; role: "user" | "assistant"; content: string; messageId?: string }
  | { kind: "thought"; content: string; messageId?: string }
  | { kind: "tool_call"; call: ToolCallState };

/**
 * Whether two chunks belong to the same logical message and should be merged.
 * Chunks with the same messageId merge; chunks with no messageId at all also
 * merge (treated as a single streaming message).
 */
function sameMessage(a: string | undefined, b: string | undefined): boolean {
  if (a !== undefined && b !== undefined) return a === b;
  if (a === undefined && b === undefined) return true;
  return false;
}

/** Convert a buffered history entry into a collapsed ChatItem for display. */
function historyEntryToChatItem(
  entry: HistoryBufferEntry,
  index: number,
  sessionId: string,
  baseTs: number,
): ChatItem {
  if (entry.kind === "thought") {
    return {
      kind: "thought",
      key: `hist_${sessionId}_${index}`,
      content: entry.content,
      messageId: entry.messageId,
    };
  }
  if (entry.kind === "tool_call") {
    return {
      kind: "tool_call",
      key: entry.call.toolCallId,
      call: entry.call,
      createdAt: baseTs + index,
    };
  }
  return {
    kind: "message",
    key: `hist_${sessionId}_${index}`,
    role: entry.role,
    content: entry.content,
    createdAt: baseTs + index,
    messageId: entry.messageId,
  };
}

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
  /** Agent capabilities advertised via `initialize` (drives the protocol panel). */
  agentCapabilities?: AgentCapabilities;
  /** Whether the `initialize` handshake completed. */
  initialized: boolean;
  agentName: string;
  /** Agent-reported capability badges derived from `initialize`. */
  capabilities: string[];
  /** Whether the transport reports an authenticated session. */
  authenticated: boolean;
  /** Whether the agent supports `logout`. */
  canLogout: boolean;
  /** Whether the agent supports `session/delete`. */
  canDeleteSession: boolean;
  /** Negotiated operating modes (may be empty until a session is set up). */
  modes: SessionMode[];
  /** Current operating mode id. */
  currentModeId?: string;
  /** Agent-reported config options (model / mode / thinking …). */
  configOptions: ConfigOption[];
  sessions: SessionSummary[];
  activeSessionId: string | null;
  /** Whether the user is in "new session" composition mode (no session yet). */
  composingNew: boolean;
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
  /** Images currently attached to the draft. */
  attachments: PendingAttachment[];
  /** Add image files to the draft (capped at MAX_IMAGES). */
  onAttachImages: (files: File[]) => void;
  /** Remove a previously-attached image by id. */
  onRemoveAttachment: (id: string) => void;

  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onModeChange: (modeId: string) => void;
  onDraftChange: (value: string) => void;
  onPrompt: (value: string) => void;
  onCancel: () => void;
  /** Archive a session by id (client-side only). Open sessions are closed on the agent first. */
  onArchiveSession: (id: string) => Promise<void>;
  /** Close an open session on the agent and drop it from the open list (no archiving). */
  onCloseSession: (id: string) => Promise<void>;
  /** Remove a session from the archive so it becomes visible again. */
  onUnarchiveSession: (id: string) => void;
  /** Sessions currently archived on the client (for the "archived" collapsible view). */
  archivedSessions: SessionSummary[];
  /** Session ids this client has open (drives per-item close/load actions). */
  openSessionIds: Set<string>;
  onConfigChange: (optionId: string, value: string) => void;
  onResolvePermission: (
    request: PendingPermission,
    outcome: string | "cancelled",
  ) => void;
  onAuthenticate: (methodId: string) => void;
  onLogout: () => void;
  onReconnect: () => void;
  onDismissError: () => void;
  /** Re-fetch `session/list` from the agent. */
  onRefreshSessions: () => Promise<void>;
  /** Whether `onRefreshSessions` is in flight. */
  refreshing: boolean;
  /** Reload the active session's authoritative history via `session/load`. */
  onRefreshSession: () => Promise<void>;
  /** Whether `onRefreshSession` is in flight. */
  refreshingSession: boolean;
}

/**
 * Drive the UI from the ACP runtime for a single gateway.
 *
 * @param gateway The gateway to connect to. Pass `null` when none is
 * configured (the adapter then reports `disconnected` and an empty session
 * list).
 */
export function useAcpPageAdapter(
  gateway: Gateway | null,
): UseAcpPageAdapterResult {
  const acp = useAcpClient({ gateway, autoConnect: true });

  const pendingPermissions = usePermissionStore((s) => s.pending);
  const permissionHistoryStore = usePermissionStore((s) => s.history);

  // ---- ephemeral view state (nothing persisted to disk) -----------------
  const [draft, setDraft] = useState("");
  const [liveTurn, setLiveTurn] = useState<LiveTurn>(EMPTY_TURN);
  const [meta, setMeta] = useState<SessionMeta>(EMPTY_META);
  const [busy, setBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [configOptions, setConfigOptions] = useState<ConfigOption[]>([]);
  const [agentSessions, setAgentSessions] = useState<SessionInfo[]>([]);
  // Full session/list payload retained so archived sessions can still be
  // rendered in the "archived" collapsible view. `agentSessions` is the
  // visible subset (archived ids filtered out).
  const [allAgentSessions, setAllAgentSessions] = useState<SessionInfo[]>([]);
  // Mirror `allAgentSessions` into a ref so async callbacks that need the full
  // list (e.g. archive/delete switch-to) read the latest value without a
  // stale closure.
  const allAgentSessionsRef = useRef<SessionInfo[]>([]);
  useEffect(() => {
    allAgentSessionsRef.current = allAgentSessions;
  }, [allAgentSessions]);
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const [usage, setUsage] = useState<UsageStats | undefined>(undefined);

  // Pending image attachments for the current draft. Object URLs are released
  // when an attachment is removed or after the draft is sent.
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  // Mirror `attachments` into a ref so `onPrompt` (a stable callback) can read
  // the latest value without re-creating on every attachment change.
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Release object URLs for a set of attachments and clear them from state.
  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const a of prev) {
        if (a.previewUrl.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
      }
      return [];
    });
  }, []);

  // Add image files to the draft, capped at MAX_IMAGES in total.
  const onAttachImages = useCallback(async (files: File[]) => {
    const slots = MAX_IMAGES - attachmentsRef.current.length;
    const picked = files.slice(0, Math.max(0, slots));
    if (picked.length === 0) return;
    const decoded = await Promise.all(
      picked.map(async (file) => {
        const data = await readFileAsBase64(file);
        const attachment: PendingAttachment = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          mimeType: file.type || "image/png",
          data,
          previewUrl: URL.createObjectURL(file),
        };
        return attachment;
      }),
    );
    setAttachments((prev) => [...prev, ...decoded]);
  }, []);

  // Remove a single attachment by id, releasing its object URL.
  const onRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target && target.previewUrl.startsWith("blob:"))
        URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // The agent's working directory, fetched from the gateway's /api/config.
  // Used as the `cwd` for session/new, session/load and session/resume.
  const agentCwdRef = useRef("/");

  // The active session is identified directly by its ACP session ID. There is
  // no local session store — the agent is the sole source of truth.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Mirror `activeSessionId` into a ref so the connect-time session-list effect
  // can read the current value without re-running every time the active
  // session changes (which would reload the list and undo local deletes).
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    // Leaving composition mode whenever a real session becomes active covers
    // session selection and connect-time auto-select without sprinkling resets
    // across every call site.
    if (activeSessionId) setComposingNew(false);
  }, [activeSessionId]);

  // "New session" composition mode: the user clicked "new session" but has not
  // sent the first message yet. No session is created on the agent until the
  // first prompt is sent (lazy creation). The composer stays enabled in this
  // mode even though `activeSessionId` is null.
  const [composingNew, setComposingNew] = useState(false);

  // Fetch the gateway config (including the agent cwd) as soon as the gateway
  // is known, so it is ready before any session operation needs it.
  useEffect(() => {
    if (!gateway?.url) return;
    const controller = new AbortController();

    (async () => {
      try {
        const origin = new URL(gateway.url).origin;
        const res = await fetch(`${origin}/api/config`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { agent?: { cwd?: string } };
        if (data?.agent?.cwd) {
          agentCwdRef.current = data.agent.cwd;
        }
      } catch (e) {
        // Ignore aborts; other errors fall back to the default "/".
        if ((e as Error).name === "AbortError") return;
      }
    })();

    return () => {
      controller.abort();
    };
  }, [gateway?.id, gateway?.url]);

  // Message history loaded from the agent (session/load). Only the active
  // session's history is held in state for rendering; it is discarded when the
  // user switches sessions and re-loaded on demand.
  const [historyItems, setHistoryItems] = useState<ChatItem[]>([]);

  // Sessions archived on the client side. The archive list is persisted to
  // localStorage (keyed by gateway id) so archived sessions stay hidden after
  // a page reload. `session/list` results are filtered against this set before
  // being rendered.
  const gatewayId = gateway?.id ?? null;
  const archivedSessions = useArchivedSessions(gatewayId);
  // Mirror the archived set into a ref so async callbacks (e.g. the
  // connect-time session-list effect) always read the latest value without
  // depending on the archive API object.
  const archivedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    archivedRef.current = archivedSessions.archived;
  }, [archivedSessions.archived]);
  // Mirror the archive mutator too, for the same reason as the open list.
  const archivedSessionsAddRef = useRef(archivedSessions.add);
  const archivedSessionsRemoveRef = useRef(archivedSessions.remove);
  useEffect(() => {
    archivedSessionsAddRef.current = archivedSessions.add;
    archivedSessionsRemoveRef.current = archivedSessions.remove;
  });

  // Sessions opened on this client via `session/new` or `session/load`. The
  // open list is persisted (keyed by gateway id) so a page reload keeps
  // track of which sessions this client holds open. It exempts sessions
  // from automatic archiving and drives the close-before-archive flow.
  const openSessions = useOpenSessions(gatewayId);
  const openRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    openRef.current = openSessions.open;
  }, [openSessions.open]);
  // Hold the latest mutators in refs so callbacks/effects can call them without
  // depending on the (unstable) `openSessions` API object. This breaks the
  // render loop where an effect runs -> mutates `open` -> `openSessions`
  // identity changes -> the effect re-runs.
  const openSessionsAddRef = useRef(openSessions.add);
  const openSessionsRemoveRef = useRef(openSessions.remove);
  const openSessionsSyncRef = useRef(openSessions.syncWith);
  useEffect(() => {
    openSessionsAddRef.current = openSessions.add;
    openSessionsRemoveRef.current = openSessions.remove;
    openSessionsSyncRef.current = openSessions.syncWith;
  });

  // Auto-archive threshold from persisted settings. `""` disables it.
  const autoArchiveThreshold = useSettingsStore((s) => s.autoArchiveThreshold);
  const autoArchiveThresholdRef = useRef(autoArchiveThreshold);
  useEffect(() => {
    autoArchiveThresholdRef.current = autoArchiveThreshold;
  }, [autoArchiveThreshold]);

  /**
   * Reconcile archive/open lists and apply automatic archiving against a fresh
   * `session/list` payload, then return the visible (un-archived) subset.
   *
   * Centralised so both the connect-time fetch and manual refresh share the
   * same state-consistency rules.
   */
  const reconcileSessions = useCallback(
    (sessions: SessionInfo[]): SessionInfo[] => {
      const liveIds = sessions.map((s) => s.sessionId);

      // State consistency: prune open ids that no longer exist on the agent.
      openSessionsSyncRef.current(liveIds);

      const archived = archivedRef.current;
      const open = openRef.current;
      const thresholdMs = parseDuration(autoArchiveThresholdRef.current);

      // Auto-archive: stale, non-open, not-yet-archived sessions.
      const toArchive = selectAutoArchiveIds(
        sessions,
        thresholdMs,
        Date.now(),
        open,
        archived,
      );
      if (toArchive.size > 0) {
        for (const id of toArchive) archivedSessionsAddRef.current(id);
      }

      // Combine the pre-existing archive set with the newly auto-archived ids
      // so the visible list reflects auto-archiving immediately (the hook's
      // state update is asynchronous, so `archivedSessions.all()` would lag).
      const effectiveArchived =
        toArchive.size > 0 ? new Set([...archived, ...toArchive]) : archived;
      const visible = effectiveArchived.size
        ? sessions.filter((s) => !effectiveArchived.has(s.sessionId))
        : sessions;
      setAllAgentSessions(sessions);
      return visible;
    },
    // Intentionally empty: all mutable inputs are read via refs so this
    // callback is stable and won't retrigger the connect effect in a loop.
    [],
  );

  // While replaying history via `session/load`, message and thought chunks
  // are diverted into this buffer instead of the live turn — the agent's
  // record is authoritative and gets flushed to `historyItems` once the
  // replay completes.
  const isLoadingHistoryRef = useRef(false);
  const historyBufferRef = useRef<HistoryBufferEntry[]>([]);

  // Track sessions created via `createNewSession` so the setup effect knows to
  // skip `session/load` (they have no history yet and are already initialised).
  const newlyCreatedRef = useRef<Set<string>>(new Set());

  // Surface runtime/session-setup errors to the console.
  useEffect(() => {
    if (setupError) console.error("[ACP adapter]", setupError);
  }, [setupError]);

  const clientRef = useRef<AcpClient | null>(null);
  // Mirror the latest `client` from the hook into a ref so async callbacks
  // (send / cancel) always read the current value.
  useEffect(() => {
    clientRef.current = acp.client;
  }, [acp.client]);

  // Mirror the live turn into a ref so the `pumpQueue` callback (which is
  // memoised on session id, not turn state) can read the *current* items when
  // the prompt promise resolves — by then streaming has populated it.
  const liveTurnRef = useRef<LiveTurn>(EMPTY_TURN);
  useEffect(() => {
    liveTurnRef.current = liveTurn;
  }, [liveTurn]);

  // Reset all session-derived state when the gateway changes so stale data
  // from the previous gateway doesn't leak into the new connection.
  const gatewayIdRef = useRef<string | null>(gateway?.id ?? null);
  const gatewaySigRef = useRef<string>("");
  useEffect(() => {
    const currentId = gateway?.id ?? null;
    // Capture url+token so editing the same gateway (id unchanged) still
    // resets the connection and session-derived state.
    const currentSig = `${currentId}|${gateway?.url ?? ""}|${gateway?.token ?? ""}`;
    if (gatewayIdRef.current === currentId && gatewaySigRef.current === currentSig)
      return;
    gatewayIdRef.current = currentId;
    gatewaySigRef.current = currentSig;
    setActiveSessionId(null);
    setAgentSessions([]);
    setHistoryItems([]);
    setLiveTurn(EMPTY_TURN);
    setBusy(false);
    setUsage(undefined);
    setMeta(EMPTY_META);
    setConfigOptions([]);
    setPlan([]);
    setSetupError(null);
    queueRef.current = [];
    setQueueDepth(0);
    newlyCreatedRef.current.clear();
  }, [gateway?.id, gateway?.url, gateway?.token]);

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
          // the agent's record is authoritative and gets flushed to
          // `historyItems` once the replay completes.
          if (isLoadingHistoryRef.current) {
            const buf = historyBufferRef.current;
            const last = buf[buf.length - 1];
            if (
              last &&
              last.kind === "message" &&
              last.role === role &&
              sameMessage(last.messageId, update.messageId)
            ) {
              last.content += text;
            } else {
              buf.push({
                kind: "message",
                role,
                content: text,
                messageId: update.messageId,
              });
            }
            break;
          }
          setLiveTurn((prev) => {
            const items = [...prev.items];
            const last = items[items.length - 1];
            if (
              last &&
              last.kind === "message" &&
              last.role === role &&
              sameMessage(last.messageId, update.messageId)
            ) {
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
                messageId: update.messageId,
              });
            }
            return { ...prev, items };
          });
          break;
        }
        case "tool_call":
        case "tool_call_update": {
          // While replaying history, buffer tool calls in arrival order so they
          // stay interleaved with messages instead of sinking to the tail.
          if (isLoadingHistoryRef.current) {
            const buf = historyBufferRef.current;
            const existing = buf.find(
              (e): e is { kind: "tool_call"; call: ToolCallState } =>
                e.kind === "tool_call" &&
                e.call.toolCallId === update.toolCallId,
            );
            const merged = mergeToolCall(existing?.call, update);
            if (existing) {
              existing.call = merged;
            } else {
              buf.push({ kind: "tool_call", call: merged });
            }
            break;
          }
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
            const createdAt =
              idx >= 0 && items[idx].kind === "tool_call"
                ? items[idx].createdAt
                : Date.now();
            const card = {
              kind: "tool_call" as const,
              key: update.toolCallId,
              call: merged,
              createdAt,
            };
            if (idx >= 0) items[idx] = card;
            else items.push(card);
            return { ...prev, items, toolCalls };
          });
          break;
        }
        case "agent_thought_chunk": {
          const text = contentToText(update.content);
          if (!text) break;
          // While replaying history, divert thought chunks into the history
          // buffer so they end up in `historyItems` with streaming=false
          // (collapsed by default) rather than stuck in the live turn.
          if (isLoadingHistoryRef.current) {
            const buf = historyBufferRef.current;
            const last = buf[buf.length - 1];
            if (
              last &&
              last.kind === "thought" &&
              sameMessage(last.messageId, update.messageId)
            ) {
              last.content += text;
            } else {
              buf.push({ kind: "thought", content: text, messageId: update.messageId });
            }
            break;
          }
          setLiveTurn((prev) => {
            const items = [...prev.items];
            const last = items[items.length - 1];
            if (
              last &&
              last.kind === "thought" &&
              sameMessage(last.messageId, update.messageId)
            ) {
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
                messageId: update.messageId,
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
          // Update the title in the agent session list directly — no local
          // session store to mutate.
          if (update.title) {
            const sid = activeSessionIdRef.current;
            setAgentSessions((prev) =>
              prev.map((s) =>
                s.sessionId === sid
                  ? { ...s, title: update.title ?? s.title }
                  : s,
              ),
            );
          }
          break;
        }
        case "plan": {
          setPlan(update.entries);
          break;
        }
        default:
          // Plans/thoughts not handled above are not first-class in the current
          // UI props; ignore them rather than risk a malformed ChatItem.
          break;
      }
    }, []);

  // Subscribe to session/update while connected.
  useEffect(() => {
    if (!acp.client) return;
    const unsubscribe = acp.client.onUpdate(applyUpdate);
    return unsubscribe;
  }, [acp.client, applyUpdate]);

  // ---- load the active session's history on demand ---------------------
  // When the active session changes (or the connection is re-established),
  // reset ephemeral state and load the session's authoritative history via
  // `session/load` / `session/resume`. Sessions created via
  // `createNewSession` are already initialised and skip this step.
  useEffect(() => {
    if (!gateway || !acp.client || !acp.connected || !activeSessionId) return;

    // Sessions created via createNewSession are already set up.
    if (newlyCreatedRef.current.has(activeSessionId)) {
      newlyCreatedRef.current.delete(activeSessionId);
      return;
    }

    let cancelled = false;

    // Reset ephemeral state for the newly-selected session.
    setLiveTurn(EMPTY_TURN);
    setBusy(false);
    setUsage(undefined);
    setSetupError(null);
    setMeta(EMPTY_META);
    setConfigOptions([]);
    setPlan([]);
    queueRef.current = [];
    setQueueDepth(0);
    setHistoryItems([]);

    void (async () => {
      const client = clientRef.current;
      if (!client) return;
      const caps = client.initializeResult?.agentCapabilities;
      const supportsLoad = caps?.loadSession === true;
      const supportsResume = !!caps?.sessionCapabilities?.resume;

      try {
        if (supportsLoad) {
          // `session/load` should replay the full conversation history over
          // session/update and return null. Some agents (e.g. Kimi Code CLI)
          // deviate: they return a SessionSetupResult with configOptions/modes
          // and do NOT replay history. We handle both cases.
          historyBufferRef.current = [];
          isLoadingHistoryRef.current = true;
          let loadResult: unknown = null;
          try {
            loadResult = await client.sessionLoad({ sessionId: activeSessionId, cwd: agentCwdRef.current });
          } catch (e) {
            isLoadingHistoryRef.current = false;
            throw e;
          }
          // Only clear the history-loading flag once we know this load is still
          // the active one; otherwise a late `session/update` from this load
          // would be misclassified as a live turn update.
          if (cancelled) {
            isLoadingHistoryRef.current = false;
            return;
          }
          isLoadingHistoryRef.current = false;

          // If the agent returned a non-null result (non-standard but observed
          // with some agents), extract configOptions/modes from it.
          if (loadResult && typeof loadResult === "object") {
            const r = loadResult as {
              modes?: import("@hermit-org/acp").SessionModeState;
              configOptions?: import("@hermit-org/acp").ConfigOption[];
            };
            if (r.modes) setMeta((m) => ({ ...m, modes: r.modes ?? null }));
            if (r.configOptions) setConfigOptions(r.configOptions);
          }

          const replayed = historyBufferRef.current;
          historyBufferRef.current = [];
          if (replayed.length > 0) {
            const now = Date.now();
            setHistoryItems(
              replayed.map((entry, i) =>
                historyEntryToChatItem(entry, i, activeSessionId, now),
              ),
            );
          }
        } else if (supportsResume) {
          const result = await client.sessionResume({
            sessionId: activeSessionId,
            cwd: agentCwdRef.current,
          });
          if (cancelled) return;
          if (result.modes)
            setMeta((m) => ({ ...m, modes: result.modes ?? null }));
          if (result.configOptions) setConfigOptions(result.configOptions);
        }
        // Whether loaded or resumed, this session is now open on the client.
        openSessionsAddRef.current(activeSessionId);
        const info = client.initializeResult?.agentInfo ?? null;
        if (info) setMeta((m) => ({ ...m, agentName: info.title ?? info.name }));
        setSetupError(null);
      } catch (e) {
        if (cancelled) return;
        setSetupError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gateway, acp.client, acp.connected, activeSessionId]);

  const supportsList =
    acp.client?.initializeResult?.agentCapabilities?.sessionCapabilities?.list !=
    null;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);

  /** Create a new agent-side session via `session/new` and select it. */
  const createNewSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return null;
    try {
      const result = await client.sessionNew({ cwd: agentCwdRef.current });
      const newInfo: SessionInfo = { sessionId: result.sessionId, cwd: agentCwdRef.current };
      setAgentSessions((prev) => [newInfo, ...prev]);
      // Track this session as open on this client.
      openSessionsAddRef.current(result.sessionId);
      // Mark as newly created so the setup effect skips session/load.
      newlyCreatedRef.current.add(result.sessionId);
      // Eagerly update the ref so an immediately-following `pumpQueue` (lazy
      // creation path) sees the new session id without waiting for a re-render.
      activeSessionIdRef.current = result.sessionId;
      setActiveSessionId(result.sessionId);
      setComposingNew(false);
      if (result.modes)
        setMeta((m) => ({ ...m, modes: result.modes ?? null }));
      if (result.configOptions) setConfigOptions(result.configOptions);
      const info = client.initializeResult?.agentInfo;
      if (info) setMeta((m) => ({ ...m, agentName: info.title ?? info.name }));
      setHistoryItems([]);
      setSetupError(null);
      return result;
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, []);

  /**
   * Re-fetch `session/list` from the agent, reconcile archive/open lists,
   * apply automatic archiving, and store the visible subset.
   */
  const refreshSessions = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !supportsList) return;
    setRefreshing(true);
    try {
      const res = await client.sessionList();
      const visible = reconcileSessions(res.sessions);
      setAgentSessions(visible);
    } catch (e) {
      console.error("[ACP adapter] session/list refresh failed:", e);
    } finally {
      setRefreshing(false);
    }
  }, [supportsList, reconcileSessions]);

  /** Reload the active session's authoritative history via `session/load`. */
  const refreshActiveSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !activeSessionId) return;
    // Snapshot the session so a fast switch invalidates a stale reload.
    const targetSessionId = activeSessionId;
    const caps = client.initializeResult?.agentCapabilities;
    const supportsLoad = caps?.loadSession === true;
    if (!supportsLoad) return;
    setRefreshingSession(true);
    setLiveTurn(EMPTY_TURN);
    setBusy(false);
    try {
      historyBufferRef.current = [];
      isLoadingHistoryRef.current = true;
      try {
        await client.sessionLoad({ sessionId: targetSessionId, cwd: agentCwdRef.current });
      } catch (e) {
        isLoadingHistoryRef.current = false;
        throw e;
      }
      // Bail if the user switched sessions while the load was in flight.
      if (activeSessionIdRef.current !== targetSessionId) {
        isLoadingHistoryRef.current = false;
        return;
      }
      isLoadingHistoryRef.current = false;
      const replayed = historyBufferRef.current;
      historyBufferRef.current = [];
      const now = Date.now();
      setHistoryItems(
        replayed.map((entry, i) =>
          historyEntryToChatItem(entry, i, targetSessionId, now),
        ),
      );
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshingSession(false);
    }
  }, [activeSessionId]);

  // ---- connect: fetch the session list from the agent ------------------
  useEffect(() => {
    if (!gateway || !acp.connected || !acp.client) return;
    let cancelled = false;

    if (supportsList) {
      acp.client
        .sessionList()
        .then((res) => {
          if (cancelled) return;
          // Reconcile archive/open lists, apply automatic archiving, and
          // derive the visible subset.
          const visible = reconcileSessions(res.sessions);
          setAgentSessions(visible);
          if (visible.length > 0) {
            // Auto-select the first session only if none is active yet.
            setActiveSessionId((prev) => prev ?? visible[0].sessionId);
          } else if (!activeSessionIdRef.current) {
            // No sessions on the agent — enter composition mode so the user can
            // start typing. A session is created lazily on the first prompt.
            setComposingNew(true);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled)
            setSetupError(
              `session/list failed: ${e instanceof Error ? e.message : String(e)}`,
            );
        });
    } else {
      // Agent does not advertise `list` — enter composition mode so the user
      // can start typing; a session is created lazily on the first prompt.
      if (!activeSessionIdRef.current) {
        setComposingNew(true);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [gateway, acp.client, acp.connected, supportsList, reconcileSessions]);

  // ---- actions ---------------------------------------------------------
  // Drain the prompt queue one turn at a time. Each question is sent as a
  // separate `session/prompt` turn and awaited before the next starts, so the
  // user can keep typing while a turn runs.
  const pumpQueue = useCallback(async () => {
    if (processingRef.current) return;
    const client = clientRef.current;
    // Read the session id from the ref (not the closure) so the lazy-creation
    // path in `onPrompt` — which creates a session and pumps in the same tick —
    // picks up the freshly-created id.
    const sessionId = activeSessionIdRef.current;
    if (!client || !sessionId) return;
    const next = queueRef.current.shift();
    if (next === undefined) return;

    processingRef.current = true;
    setBusy(true);
    setSetupError(null);
    setLiveTurn(EMPTY_TURN);

    // Add the user's message to the visible history immediately.
    setHistoryItems((prev) => [
      ...prev,
      {
        kind: "message",
        key: `u_${Date.now()}`,
        role: "user",
        content: next.text,
        images:
          next.images.length > 0
            ? next.images.map((img) => ({
                data: img.data,
                mimeType: img.mimeType,
              }))
            : undefined,
        createdAt: Date.now(),
      },
    ]);

    try {
      // Image blocks precede the text block (text omitted if empty, e.g. an
      // image-only prompt). This matches the conventional ordering agents
      // expect from multimodal prompts.
      const prompt: ContentBlock[] = [
        ...next.images,
        ...(next.text ? [{ type: "text" as const, text: next.text }] : []),
      ];
      await client.sessionPrompt({ sessionId, prompt });
      // Commit the full live turn into history, preserving the interleaved
      // order of thoughts, tool calls and the assistant message so the
      // thinking content is not lost when the turn completes (consistent
      // with how it was displayed live). User-role messages are skipped:
      // the user's text was already added to history before the prompt was
      // sent, and some agents echo it back as a user_message_chunk.
      const committed = liveTurnRef.current.items.filter(
        (it) => !(it.kind === "message" && it.role === "user"),
      );
      if (committed.length > 0) {
        setHistoryItems((prev) => [
          ...prev,
          ...committed.map((it) =>
            it.kind === "message" || it.kind === "thought"
              ? { ...it, streaming: false }
              : it,
          ),
        ]);
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
  }, []);

  const onPrompt = useCallback(
    async (value: string) => {
      const text = value.trim();
      // Snapshot the current attachments so they ride along with this turn,
      // then release their object URLs and clear the strip.
      const pending = attachmentsRef.current;
      const images: ImageContent[] = pending.map((a) => ({
        type: "image",
        data: a.data,
        mimeType: a.mimeType,
      }));
      // Allow an image-only prompt: proceed when there is text OR images.
      if (!text && images.length === 0) return;
      // Lazy session creation: when there is no active session (e.g. the user
      // clicked "new session" and is now sending the first message), create
      // the session on the agent before queueing the prompt. `createNewSession`
      // eagerly updates `activeSessionIdRef` so the subsequent `pumpQueue` sees
      // the new id.
      if (!activeSessionIdRef.current) {
        const result = await createNewSession();
        if (!result) return;
      }
      setDraft("");
      if (images.length > 0) clearAttachments();
      queueRef.current.push({ text, images });
      setQueueDepth((n) => n + 1);
      void pumpQueue();
    },
    [createNewSession, pumpQueue, clearAttachments],
  );

  const onCancel = useCallback(async () => {
    const client = clientRef.current;
    queueRef.current = [];
    setQueueDepth(0);
    if (!client || !activeSessionId) return;
    try {
      await client.sessionCancel({ sessionId: activeSessionId });
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : String(e));
    }
  }, [activeSessionId]);

  const onModeChange = useCallback(
    async (modeId: string) => {
      const client = clientRef.current;
      if (!client || !activeSessionId) return;
      try {
        await client.sessionSetMode({ sessionId: activeSessionId, modeId });
        setMeta((m) =>
          m.modes ? { ...m, modes: { ...m.modes, currentModeId: modeId } } : m,
        );
      } catch (e) {
        setSetupError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeSessionId],
  );

  const onDraftChange = useCallback((value: string) => {
    setDraft(value);
  }, []);

  const onSelectSession = useCallback(
    (id: string) => {
      // Session IDs are ACP session IDs directly — no local indirection.
      // If the session is currently archived, un-archive it first so it is
      // visible again before loading.
      if (archivedRef.current.has(id)) {
        archivedSessionsRemoveRef.current(id);
        // Compute the post-removal archive set locally — the hook's state
        // update is asynchronous, so `archivedSessions.all()` would lag.
        const archived = new Set(archivedRef.current);
        archived.delete(id);
        const all = allAgentSessionsRef.current;
        const visible = archived.size
          ? all.filter((s) => !archived.has(s.sessionId))
          : all;
        setAgentSessions(visible);
      }
      setActiveSessionId(id);
    },
    [],
  );

  const onCreateSession = useCallback(() => {
    // Enter "new session" composition mode. No session is created on the agent
    // until the first message is sent — the session is created lazily inside
    // `onPrompt`. This avoids creating empty sessions when the user just wants
    // to start typing.
    setComposingNew(true);
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
    // Reset ephemeral view state so the chat area is clean.
    setHistoryItems([]);
    setLiveTurn(EMPTY_TURN);
    setBusy(false);
    setUsage(undefined);
    setSetupError(null);
    setMeta(EMPTY_META);
    setConfigOptions([]);
    setPlan([]);
    queueRef.current = [];
    setQueueDepth(0);
    setDraft("");
    clearAttachments();
  }, [clearAttachments]);

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
      if (!client || !activeSessionId) return;
      // Snapshot the current value so a failed request can restore it. The
      // snapshot is read from the live state via the functional update.
      let previousValue: string | undefined;
      setConfigOptions((prev) => {
        previousValue = prev.find((o) => o.id === optionId)?.currentValue;
        // Optimistic update so the chip reflects the change immediately.
        return prev.map((o) =>
          o.id === optionId ? { ...o, currentValue: value } : o,
        );
      });
      try {
        const result = await client.sessionSetConfigOption({
          sessionId: activeSessionId,
          configId: optionId,
          value,
        });
        if (result.configOption) {
          const updated = result.configOption;
          setConfigOptions((latest) =>
            latest.map((o) => (o.id === updated.id ? updated : o)),
          );
        }
      } catch (e) {
        // Revert the optimistic update on failure. Restore the captured value
        // but apply it functionally against the latest state.
        console.error("[ACP adapter] set_config_option failed:", e);
        const restore = previousValue;
        setConfigOptions((latest) =>
          latest.map((o) =>
            o.id === optionId && restore !== undefined
              ? { ...o, currentValue: restore }
              : o,
          ),
        );
      }
    },
    [activeSessionId],
  );

  /**
   * Close a session on the agent and drop it from the local open list.
   *
   * Closing releases agent-side resources but does NOT archive the session —
   * it remains visible in the sidebar. Use `onArchiveSession` to also hide it.
   */
  const onCloseSession = useCallback(
    async (id: string) => {
      if (!id) return;
      const client = clientRef.current;
      if (!client) return;
      const supportsClose =
        !!client.initializeResult?.agentCapabilities?.sessionCapabilities
          ?.close;
      if (supportsClose) {
        try {
          await client.sessionClose({ sessionId: id });
        } catch (e) {
          setSetupError(
            `session/close failed: ${e instanceof Error ? e.message : String(e)}`,
          );
          return;
        }
      }
      // Released on the agent (or agent doesn't support close) — drop from
      // the open list, but keep visible.
      openSessionsRemoveRef.current(id);
    },
    [],
  );

  /**
   * Archive a session on the client side. If the session is currently open
   * on this client, it is first closed on the agent (`session/close`) to
   * release resources, then removed from the open list and added to the
   * archive. Non-open sessions are archived directly.
   */
  const onArchiveSession = useCallback(
    async (id: string) => {
      if (!id) return;
      if (typeof window !== "undefined" && !window.confirm("Archive this session?")) return;

      const client = clientRef.current;
      const supportsClose =
        !!client?.initializeResult?.agentCapabilities?.sessionCapabilities
          ?.close;
      // If this session is open on the client, close it on the agent first
      // (only if the agent supports session/close).
      if (openRef.current.has(id) && client && supportsClose) {
        try {
          await client.sessionClose({ sessionId: id });
        } catch (e) {
          setSetupError(
            `session/close failed: ${e instanceof Error ? e.message : String(e)}`,
          );
          return;
        }
        openSessionsRemoveRef.current(id);
      } else if (openRef.current.has(id)) {
        // Agent doesn't support close — just remove from the open list.
        openSessionsRemoveRef.current(id);
      }

      // Hide from the visible list.
      setAgentSessions((prev) => prev.filter((s) => s.sessionId !== id));
      // Duplicate-archive is a silent no-op in the hook.
      archivedSessionsAddRef.current(id);

      // If this was the active session, switch to another visible one. Read
      // the latest list functionally to avoid acting on a stale snapshot.
      setActiveSessionId((current) => {
        if (current !== id) return current;
        // Derive the next active id from the current visible list minus the
        // archived one.
        const visible = allAgentSessionsRef.current.filter(
          (s) => s.sessionId !== id,
        );
        return visible[0]?.sessionId ?? null;
      });
    },
    [],
  );

  /**
   * Remove a session from the archive so it reappears in the visible list.
   * The session is not loaded automatically — the user can click it to load.
   */
  const onUnarchiveSession = useCallback(
    (id: string) => {
      archivedSessionsRemoveRef.current(id);
      // Compute the post-removal archive set locally — the hook's state
      // update is asynchronous, so `archivedSessions.all()` would lag.
      const archived = new Set(archivedRef.current);
      archived.delete(id);
      const all = allAgentSessionsRef.current;
      const visible = archived.size
        ? all.filter((s) => !archived.has(s.sessionId))
        : all;
      setAgentSessions(visible);
    },
    [],
  );

  // Delete a session on the agent (when supported) and remove it from the
  // local view.
  const onDeleteSession = useCallback(
    async (id: string) => {
      const client = clientRef.current;
      const supportsDelete =
        client?.initializeResult?.agentCapabilities?.sessionCapabilities
          ?.delete != null;
      const acpId = id; // IDs are ACP session IDs directly.

      // Only confirm when the agent will actually be asked to delete.
      if (
        supportsDelete &&
        typeof window !== "undefined" &&
        !window.confirm("Delete this session?")
      )
        return;

      // Remove from local state.
      setAgentSessions((prev) => prev.filter((s) => s.sessionId !== acpId));
      setAllAgentSessions((prev) =>
        prev.filter((s) => s.sessionId !== acpId),
      );
      archivedSessionsRemoveRef.current(acpId);
      openSessionsRemoveRef.current(acpId);

      // If this was the active session, switch to another (or none). Read the
      // latest list functionally to avoid a stale snapshot.
      setActiveSessionId((current) => {
        if (current !== acpId) return current;
        const visible = allAgentSessionsRef.current.filter(
          (s) => s.sessionId !== acpId,
        );
        return visible[0]?.sessionId ?? null;
      });

      // Only send `session/delete` when the agent advertises support —
      // otherwise the removal is local-only.
      if (supportsDelete && client) {
        try {
          await client.sessionDelete({ sessionId: acpId });
        } catch (e) {
          setSetupError(
            `session/delete failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    },
    [],
  );

  // ---- map state -> UI props -------------------------------------------
  // Derive session summaries directly from the agent's session list — no
  // local session records to merge.
  const toSummary = useCallback(
    (info: SessionInfo): SessionSummary => {
      let updatedAt: number;
      if (info.updatedAt) {
        const parsed = new Date(info.updatedAt).getTime();
        // Guard against invalid dates that produce NaN (which would corrupt
        // the sort order). Fall back to now so it sorts as recent.
        updatedAt = Number.isFinite(parsed) ? parsed : Date.now();
      } else {
        updatedAt = Date.now();
      }
      return {
        id: info.sessionId,
        title: info.title ?? info.sessionId.slice(0, 12),
        updatedAt,
      };
    },
    [],
  );

  const sessionSummaries: SessionSummary[] = useMemo(
    () =>
      agentSessions
        .map(toSummary)
        .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt)),
    [agentSessions, toSummary],
  );

  // Archived sessions, derived from the full list for the collapsible view.
  const archivedSessionSummaries: SessionSummary[] = useMemo(() => {
    const archived = archivedSessions.archived;
    if (archived.size === 0) return [];
    return allAgentSessions
      .filter((info) => archived.has(info.sessionId))
      .map(toSummary)
      .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
  }, [allAgentSessions, archivedSessions.archived, toSummary]);

  const chatItems: ChatItem[] = useMemo(
    () => [...historyItems, ...liveTurn.items],
    [historyItems, liveTurn.items],
  );

  const toolCalls: ToolCallState[] = useMemo(
    () => Array.from(liveTurn.toolCalls.values()),
    [liveTurn.toolCalls],
  );

  const permissionsUi: PendingPermission[] = useMemo(
    () =>
      pendingPermissions.map<PendingPermission>((p) => ({
        id: p.id,
        // Keep `sessionId` as null when there is no active session instead of
        // a meaningless empty string.
        sessionId: activeSessionId,
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

  // Derive capability badges from the real `initialize` result.
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

  // Whether the agent implements the optional `session/delete` method.
  // Used to gate the delete action in the UI (hide it when unsupported).
  const canDeleteSession = useMemo(
    () =>
      acp.client?.initializeResult?.agentCapabilities?.sessionCapabilities
        ?.delete != null,
    [acp.client?.initializeResult?.agentCapabilities],
  );

  // Surface runtime/setup errors (setupError takes precedence over a raw
  // transport error).
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

  return {
    connectionStatus,
    requireAuth,
    protocolVersion,
    agentCapabilities: acp.client?.initializeResult?.agentCapabilities,
    initialized: acp.connected,
    agentName,
    capabilities,
    authenticated: acp.authenticated,
    canLogout: acp.canLogout,
    canDeleteSession,
    modes,
    currentModeId: meta.modes?.currentModeId,
    configOptions,
    sessions: sessionSummaries,
    archivedSessions: archivedSessionSummaries,
    openSessionIds: openSessions.open,
    activeSessionId,
    composingNew,
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
    attachments,
    onAttachImages,
    onRemoveAttachment,
    onSelectSession,
    onCreateSession,
    onModeChange,
    onDraftChange,
    onPrompt,
    onCancel,
    onCloseSession,
    onArchiveSession,
    onUnarchiveSession,
    onConfigChange,
    onDeleteSession,
    onResolvePermission,
    onAuthenticate,
    onLogout,
    onReconnect,
    onDismissError,
    refreshing,
    onRefreshSessions: refreshSessions,
    refreshingSession,
    onRefreshSession: refreshActiveSession,
  };
}
