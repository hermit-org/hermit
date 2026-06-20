import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGatewayStore, useSessionStore, useSettingsStore } from "../stores";
import { useAcpClient } from "../acp/hooks";
import { ChatMessage } from "../components/ChatMessage";
import {
  ToolCallView,
  mergeToolCall,
  type ToolCallState,
} from "../components/ToolCallView";
import { ThoughtView } from "../components/ThoughtView";
import { SendHorizontal, Cpu, Gauge, Layers, BrainCog, OctagonX, X } from "lucide-react";
import {
  ModeView,
} from "../components/SessionMeta";
import { AuthPanel } from "../components/AuthPanel";
import { CommandSuggest } from "../components/CommandSuggest";
import { ConfigChip } from "../components/ConfigChip";
import { TodoView } from "../components/TodoView";
import { ToolQuestionsView } from "../components/ToolQuestionsView";
import type { Gateway, Message } from "../types";
import type {
  SessionUpdate,
  PlanEntry,
  UsageUpdate as UsageUpdateType,
  SessionModeState,
  AvailableCommand,
  ContentBlock,
  AcpClient,
  ImplementationInfo,
  ConfigOption,
} from "@hermit/acp";

interface ChatScreenProps {
  sessionId: string;
  onBack: () => void;
}

/**
 * Items rendered in a prompt turn, in arrival order. A turn's assistant
 * output is a mix of message chunks, tool calls, and (out-of-band) plan/usage.
 */
type TurnItem =
  | { kind: "message"; role: "user" | "assistant"; messageId?: string; content: string }
  | { kind: "thought"; content: string }
  | { kind: "toolCall"; call: ToolCallState };

interface TurnState {
  items: TurnItem[];
  toolCalls: Map<string, ToolCallState>;
  plan: PlanEntry[] | null;
  usage: UsageUpdateType | null;
}

const EMPTY_TURN: TurnState = {
  items: [],
  toolCalls: new Map(),
  plan: null,
  usage: null,
};

/** Session-level meta that persists across turns (modes, commands). */
interface SessionMeta {
  modes: SessionModeState | null;
  commands: AvailableCommand[];
}

export function ChatScreen({ sessionId, onBack }: ChatScreenProps): React.JSX.Element {
  const { t } = useTranslation();

  const session = useSessionStore((state) =>
    state.sessions.find((s) => s.id === sessionId),
  );
  const localMessages = useSessionStore((state) =>
    state.getSessionMessages(sessionId),
  );
  const { addMessage, setMessages, setSessionAcpId, setSessionConfig, setSessionTitle, setSessionClosed } =
    useSessionStore();

  const gateway = useGatewayStore((state: { gateways: Gateway[] }) =>
    state.gateways.find((g) => g.id === session?.gatewayId),
  );

  const [input, setInput] = useState("");
  const [turn, setTurn] = useState<TurnState>(EMPTY_TURN);
  const [meta, setMeta] = useState<SessionMeta>({ modes: null, commands: [] });
  // Starts as null so the effect below can run to resume/create the
  // session on the agent side. The stored `acpSessionId` is read inside
  // the effect (NOT here) — otherwise the guard would skip the
  // `session/resume` call entirely.
  const [acpSessionId, setAcpSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<ImplementationInfo | null>(null);
  // Configurable options reported by the agent (model, mode, thinking, etc.).
  // Initialised from the store so chips survive a reopen where
  // session/load returns null.
  const [configOptions, setConfigOptions] = useState<ConfigOption[]>(
    session?.configOptions ?? [],
  );
  // Usage persists across turns (unlike `turn.usage` which resets on send)
  // so the context-size chip is always visible in the input toolbar.
  const [lastUsage, setLastUsage] = useState<UsageUpdateType | null>(null);
  // Number of questions waiting to be sent (queued) + the one in flight.
  const [queueDepth, setQueueDepth] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Accumulates the assistant text for the in-flight turn so `handleSend` can
  // read the latest value after the prompt promise resolves.
  const turnAssistantRef = useRef("");
  // Prompt queue: each entry is a question to send as its own turn. A single
  // send and a multi-question confirm both push here; a background pump drains
  // the queue one turn at a time so the user can keep typing while it works.
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  // While `session/load` replays the agent's history, message chunks are
  // collected here (the agent's record is authoritative) and flushed to the
  // store once the replay completes. A `messageId` starts a new entry;
  // subsequent chunks with the same id (or no id) append to the last one of
  // that role.
  const isLoadingHistoryRef = useRef(false);
  const historyBufferRef = useRef<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // Configurable: how many lines of a thought block to show when collapsed.
  const thoughtPreviewLines = useSettingsStore(
    (s) => s.thoughtPreviewLines,
  );

  // Responsive input sizing: on short screens use a single-line input to
  // maximise message space; otherwise show a 3-line textarea.
  const inputRows = useInputRows();

  const {
    client,
    connected,
    state: connectionState,
    connect,
    authMethods,
    canLogout,
    authenticated,
    authenticate,
    logout,
  } = useAcpClient({
    gateway: gateway ?? null,
    autoConnect: true,
  });
  const clientRef = useRef<AcpClient | null>(null);
  clientRef.current = client;

  // Establish (or resume) an ACP session once the client is connected.
  // If the local session already has an `acpSessionId` persisted from a
  // previous open, we try to resume/load it so the agent's conversation
  // context is preserved. Otherwise we create a new session.
  useEffect(() => {
    if (!client || !connected || acpSessionId) return;
    void (async () => {
      const storedAcpId = session?.acpSessionId;
      const caps = client.initializeResult?.agentCapabilities;
      const supportsLoad = caps?.loadSession === true;
      const supportsResume = !!caps?.sessionCapabilities?.resume;

      // eslint-disable-next-line no-console
      console.debug("[ACP] capabilities:", {
        supportsLoad,
        supportsResume,
        full: client.initializeResult,
      });
      // eslint-disable-next-line no-console
      console.debug("[ACP] stored acpSessionId:", storedAcpId);

      // If we have a stored session AND the agent supports resume/load,
      // try to restore it. Otherwise create a new session.
      const shouldRestore = storedAcpId && (supportsLoad || supportsResume);

      try {
        let result;
        if (shouldRestore && supportsLoad) {
          // eslint-disable-next-line no-console
          console.debug("[ACP] session/load:", storedAcpId);
          // The agent replays the full conversation history over
          // session/update. Treat that record as authoritative: discard the
          // local cache and rebuild it from the replay.
          historyBufferRef.current = [];
          isLoadingHistoryRef.current = true;
          try {
            await client.sessionLoad({
              sessionId: storedAcpId,
              cwd: "/",
            });
          } finally {
            isLoadingHistoryRef.current = false;
          }
          // Flush the replayed history into the store (replacing any prior
          // local copy) so it survives a re-open or a subsequent prompt.
          const replayed = historyBufferRef.current;
          historyBufferRef.current = [];
          if (replayed.length > 0) {
            setMessages(sessionId, replayed);
          }
          // session/load returns null per spec; synthesize the result.
          result = { sessionId: storedAcpId };
        } else if (shouldRestore && supportsResume) {
          // eslint-disable-next-line no-console
          console.debug("[ACP] session/resume:", storedAcpId);
          result = await client.sessionResume({
            sessionId: storedAcpId,
            cwd: "/",
          });
        } else {
          if (storedAcpId) {
            // eslint-disable-next-line no-console
            console.debug(
              "[ACP] agent does not support resume/load, creating new session",
            );
          } else {
            // eslint-disable-next-line no-console
            console.debug("[ACP] session/new");
          }
          result = await client.sessionNew({ cwd: "/" });
        }
        // eslint-disable-next-line no-console
        console.debug("[ACP] session setup result:", result);
        setAcpSessionId(result.sessionId);
        // Persist the ACP session ID for next time.
        setSessionAcpId(sessionId, result.sessionId);
        if (result.modes) {
          setMeta((m) => ({ ...m, modes: result.modes ?? null }));
        }
        if (result.configOptions) {
          setConfigOptions(result.configOptions);
          setSessionConfig(sessionId, result.configOptions);
        }
        const info = client.initializeResult?.agentInfo ?? null;
        if (info) setAgentInfo(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[ACP] session setup failed:", e);
        // If resume/load failed, fall back to creating a fresh session
        // so the user can still chat.
        if (shouldRestore) {
          try {
            // eslint-disable-next-line no-console
            console.debug("[ACP] fallback to session/new");
            const fresh = await client.sessionNew({ cwd: "/" });
            setAcpSessionId(fresh.sessionId);
            setSessionAcpId(sessionId, fresh.sessionId);
            if (fresh.modes) {
              setMeta((m) => ({ ...m, modes: fresh.modes ?? null }));
            }
            if (fresh.configOptions) {
              setConfigOptions(fresh.configOptions);
              setSessionConfig(sessionId, fresh.configOptions);
            }
            const info = client.initializeResult?.agentInfo ?? null;
            if (info) setAgentInfo(info);
            return;
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : String(e2));
            return;
          }
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [client, connected, acpSessionId, session?.acpSessionId, sessionId, setSessionAcpId, setSessionConfig]);

  // Subscribe to session/update notifications.
  useEffect(() => {
    if (!client) return;
    return client.onUpdate((update: SessionUpdate) => {
      applyUpdate(update);
    });
  }, [client]);

  const applyUpdate = useCallback((update: SessionUpdate) => {
    // Debug: log every session/update so we can see what the agent actually
    // sends (usage, modes, non-standard fields, etc.).
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug("[ACP] session/update:", update.sessionUpdate, update);
    }

    switch (update.sessionUpdate) {
      case "agent_thought_chunk": {
        const text = contentToText(update.content);
        setTurn((prev) => {
          const items = [...prev.items];
          const last = items[items.length - 1];
          if (last && last.kind === "thought") {
            items[items.length - 1] = { ...last, content: last.content + text };
          } else {
            items.push({ kind: "thought", content: text });
          }
          return { ...prev, items };
        });
        break;
      }
      case "agent_message_chunk":
      case "user_message_chunk": {
        const role = update.sessionUpdate === "agent_message_chunk" ? "assistant" : "user";
        const text = contentToText(update.content);

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
          return;
        }

        if (role === "assistant") turnAssistantRef.current += text;
        setTurn((prev) => {
          const items = [...prev.items];
          // Append to the last message item if same role & messageId.
          const last = items[items.length - 1];
          if (last && last.kind === "message" && last.role === role) {
            items[items.length - 1] = {
              ...last,
              content: last.content + text,
            };
          } else {
            items.push({ kind: "message", role, messageId: update.messageId, content: text });
          }
          return { ...prev, items };
        });
        break;
      }
      case "tool_call":
      case "tool_call_update": {
        setTurn((prev) => {
          const existing = prev.toolCalls.get(update.toolCallId);
          const merged = mergeToolCall(existing, update);
          const toolCalls = new Map(prev.toolCalls);
          toolCalls.set(update.toolCallId, merged);
          const items = [...prev.items];
          if (!existing) {
            items.push({ kind: "toolCall", call: merged });
          } else {
            const idx = items.findIndex(
              (it) => it.kind === "toolCall" && it.call.toolCallId === update.toolCallId,
            );
            if (idx >= 0) items[idx] = { kind: "toolCall", call: merged };
          }
          return { ...prev, items, toolCalls };
        });
        break;
      }
      case "plan":
        setTurn((prev) => ({ ...prev, plan: update.entries }));
        break;
      case "usage_update":
        setTurn((prev) => ({ ...prev, usage: update }));
        setLastUsage(update);
        break;
      case "current_mode_update":
        setMeta((m) => {
          if (!m.modes) {
            // Agent sends mode updates without declaring availableModes
            // in session/new. Track the current modeId so we can at least
            // display something.
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
      case "available_commands_update":
        setMeta((m) => ({ ...m, commands: update.availableCommands }));
        break;
      case "session_info_update":
        // Persist title updates reported by the agent.
        if (update.title) {
          setSessionTitle(sessionId, update.title);
        }
        break;
      default:
        // Catch non-standard update types (some agents embed usage/model
        // info in custom sessionUpdate values). Log for diagnosis.
        if (typeof console !== "undefined") {
          // eslint-disable-next-line no-console
          console.debug("[ACP] unhandled update type:", (update as { sessionUpdate: string }).sessionUpdate, update);
        }
        break;
    }
  }, [sessionId, setSessionTitle]);

  // Auto-scroll.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turn, localMessages]);

  // Cancel the in-flight turn via `session/cancel`, and drop any remaining
  // queued questions so a Stop actually halts everything.
  const handleCancel = useCallback(async () => {
    const client = clientRef.current;
    queueRef.current = [];
    setQueueDepth(0);
    if (!client || !acpSessionId) return;
    try {
      await client.sessionCancel({ sessionId: acpSessionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [acpSessionId]);

  // Switch the session operating mode via `session/set_mode`.
  const handleModeChange = useCallback(
    async (modeId: string) => {
      const client = clientRef.current;
      if (!client || !acpSessionId) return;
      try {
        await client.sessionSetMode({ sessionId: acpSessionId, modeId });
        setMeta((m) =>
          m.modes ? { ...m, modes: { ...m.modes, currentModeId: modeId } } : m,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [acpSessionId],
  );

  // Close the agent-side session via `session/close`.
  const handleCloseSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !acpSessionId) return;
    if (!window.confirm(t("chat.closeSessionConfirm"))) return;
    try {
      await client.sessionClose({ sessionId: acpSessionId });
      setSessionClosed(sessionId, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [acpSessionId, sessionId, setSessionClosed, t]);

  // Send a single question (single-mode composer / Enter key). Pushes onto
  // the queue and kicks the pump; the user can keep typing while it runs.
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !acpSessionId) return;
    setInput("");
    queueRef.current.push(text);
    setQueueDepth((n) => n + 1);
    void pumpQueue();
  }, [input, acpSessionId]);

  // Drain the queue one turn at a time. Each question is sent as a separate
  // `session/prompt` turn and awaited before the next starts.
  const pumpQueue = useCallback(async () => {
    if (processingRef.current) return;
    const client = clientRef.current;
    if (!client || !acpSessionId) return;
    const next = queueRef.current.shift();
    if (next === undefined) return;

    processingRef.current = true;
    setBusy(true);
    setError(null);
    addMessage(sessionId, "user", next);
    setTurn({ ...EMPTY_TURN, toolCalls: new Map() });
    turnAssistantRef.current = "";

    try {
      const prompt: ContentBlock[] = [{ type: "text", text: next }];
      await client.sessionPrompt({ sessionId: acpSessionId, prompt });
      if (turnAssistantRef.current) {
        addMessage(sessionId, "assistant", turnAssistantRef.current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setQueueDepth((n) => Math.max(0, n - 1));
      processingRef.current = false;
      if (queueRef.current.length > 0) {
        void pumpQueue();
      } else {
        setBusy(false);
      }
    }
  }, [acpSessionId, sessionId, addMessage]);

  const handleCommandPick = useCallback((text: string) => {
    setInput(text);
  }, []);

  // Change an agent config option (model / mode / thinking …) via
  // `session/set_config_option`. Updates local state optimistically and
  // refreshes from the response if the agent returns the updated option.
  const handleConfigChange = useCallback(
    async (optionId: string, value: string) => {
      const client = clientRef.current;
      if (!client || !acpSessionId) return;
      // Optimistic update so the chip reflects the change immediately.
      setConfigOptions((prev) => {
        const next = prev.map((o) =>
          o.id === optionId ? { ...o, currentValue: value } : o,
        );
        setSessionConfig(sessionId, next);
        return next;
      });
      try {
        const result = await client.sessionSetConfigOption({
          sessionId: acpSessionId,
          id: optionId,
          value,
        });
        if (result.configOption) {
          setConfigOptions((prev) => {
            const next = prev.map((o) =>
              o.id === result.configOption!.id ? result.configOption! : o,
            );
            setSessionConfig(sessionId, next);
            return next;
          });
        }
      } catch (e) {
        // Revert optimistic update on failure.
        // eslint-disable-next-line no-console
        console.error("[ACP] set_config_option failed:", e);
        setConfigOptions((prev) =>
          prev.map((o) =>
            o.id === optionId
              ? { ...o, currentValue: o.currentValue }
              : o,
          ),
        );
      }
    },
    [acpSessionId, sessionId, setSessionConfig],
  );

  if (!gateway) {
    return (
      <div style={styles.center}>
        <div style={styles.muted}>{t("chat.gatewayNotFound")}</div>
        <button style={styles.button} onClick={onBack}>
          {t("chat.back")}
        </button>
      </div>
    );
  }

  // Single-mode send is allowed whenever a session exists — even while a
  // turn is in flight, the question just queues up behind it.
  const canSend = connected && !!acpSessionId && !!input.trim();

  // Derived values for the compact status bar under the input.
  const usage = lastUsage ?? turn.usage;

  // Kimi Code CLI reports model/mode/thinking via `configOptions` (an agent
  // extension). Standard ACP agents report modes via `meta.modes`. The chips
  // are rendered from the raw configOptions so they can be switched in-place.
  const configModel = configOptions.find((c) => c.id === "model");
  const configMode = configOptions.find((c) => c.id === "mode");
  const configThinking = configOptions.find((c) => c.id === "thinking");

  // Fallback model name for agents that don't report configOptions.
  const modelName =
    agentInfo?.title ?? agentInfo?.name ?? undefined;

  return (
    <div style={styles.container}>
      <div style={styles.statusBar}>
        <button style={styles.backButton} onClick={onBack}>
          ‹
        </button>
        <span style={styles.statusText}>
          {connectionState}
          {acpSessionId ? ` · ${t("chat.ready")}` : ""}
          {busy ? ` · ${t("chat.working")}` : ""}
        </span>
        <AuthPanel
          authMethods={authMethods}
          canLogout={canLogout}
          authenticated={authenticated}
          onAuthenticate={authenticate}
          onLogout={logout}
        />
        {acpSessionId && !session?.closed && (
          <button
            type="button"
            style={styles.closeButton}
            onClick={handleCloseSession}
            title={t("chat.closeSession")}
            aria-label={t("chat.closeSession")}
          >
            <X size={14} />
          </button>
        )}
        {!connected && (
          <button style={styles.reconnect} onClick={connect}>
            {t("chat.reconnect")}
          </button>
        )}
      </div>

      {meta.modes && (
        <ModeView
          modes={meta.modes}
          onSelectMode={acpSessionId ? handleModeChange : undefined}
        />
      )}

      <div ref={listRef} style={styles.list}>
        {localMessages.map((m: Message) => (
          <ChatMessage key={m.id} message={m} />
        ))}

        {/* Current in-flight turn */}
        {turn.items.map((item, i) => {
          if (item.kind === "toolCall") {
            return <ToolCallView key={`tc-${item.call.toolCallId}`} call={item.call} />;
          }
          if (item.kind === "thought") {
            return (
              <ThoughtView
                key={`th-${i}`}
                content={item.content}
                busy={busy}
                maxLines={thoughtPreviewLines}
              />
            );
          }
          if (item.role === "user") {
            return (
              <div key={i} style={styles.userEcho}>
                <ChatMessage
                  message={{
                    id: `turn-u-${i}`,
                    sessionId,
                    role: "user",
                    content: item.content,
                    createdAt: Date.now(),
                  }}
                />
              </div>
            );
          }
          if (item.content) {
            return <ChatMessage key={i} message={{
              id: `turn-a-${i}`,
              sessionId,
              role: "assistant",
              content: item.content,
              createdAt: Date.now(),
            }} />;
          }
          return null;
        })}

        {/* plan/todo now lives in the input dock, not the message stream */}

        {busy && turn.items.length === 0 && (
          <div style={styles.thinking}>▋</div>
        )}
        {error && <div style={styles.error}>⚠ {error}</div>}
      </div>

      {/* Input dock: elements that stay attached to the composer —
          tool questions (agent-initiated prompts, inline) and the todo/plan. */}
      <div style={styles.inputDock}>
        <ToolQuestionsView />
        {turn.plan && <TodoView entries={turn.plan} />}
      </div>

      <div style={styles.inputArea}>
        {queueDepth > 0 && (
          <div style={styles.queueRow}>
            <span style={styles.queueBadge}>
              {queueDepth} {t("chat.queued")}
            </span>
          </div>
        )}
        <div style={styles.inputWrap}>
          <CommandSuggest
            commands={meta.commands}
            input={input}
            onPick={handleCommandPick}
          />
          <textarea
            style={styles.input}
            placeholder={t("chat.placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={inputRows}
          />
        </div>
        <div style={styles.inputToolbar}>
          <div style={styles.metaBar}>
            {usage && (
              <span style={styles.metaChip} title={t("chat.contextTokens")}>
                <Gauge size={12} style={styles.metaIcon} />
                {formatTokens(usage.used)} / {formatTokens(usage.size)}
              </span>
            )}
            {configMode && (
              <ConfigChip
                option={configMode}
                icon={<Layers size={12} style={styles.metaIcon} />}
                onSelect={(value) => handleConfigChange(configMode.id, value)}
              />
            )}
            {configThinking && (
              <ConfigChip
                option={configThinking}
                icon={<BrainCog size={12} style={styles.metaIcon} />}
                onSelect={(value) =>
                  handleConfigChange(configThinking.id, value)
                }
              />
            )}
            {configModel && (
              <ConfigChip
                option={configModel}
                icon={<Cpu size={12} style={styles.metaIcon} />}
                onSelect={(value) => handleConfigChange(configModel.id, value)}
              />
            )}
            {!configModel && modelName && (
              <span style={styles.metaChip} title={agentInfo?.version}>
                <Cpu size={12} style={styles.metaIcon} />
                {modelName}
              </span>
            )}
          </div>
          {busy ? (
            <button
              type="button"
              style={styles.stopButton}
              onClick={handleCancel}
              aria-label={t("chat.stop")}
              title={t("chat.stop")}
            >
              <OctagonX size={18} />
            </button>
          ) : (
            <button
              style={{
                ...styles.sendButton,
                ...(!canSend && styles.sendDisabled),
              }}
              onClick={handleSend}
              disabled={!canSend}
              aria-label={t("chat.send")}
            >
              <SendHorizontal size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function contentToText(content: ContentBlock): string {
  if (content.type === "text") return content.text;
  if (content.type === "resource" && "text" in content.resource) {
    return content.resource.text;
  }
  if (content.type === "resource_link") return content.name;
  return "";
}

/** Compact token count formatting (e.g. 1200 → "1.2k"). */
function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Returns the number of textarea rows based on the viewport height.
 *
 * Short screens (e.g. mobile landscape, half-height windows) get a single
 * line to maximise the visible message list; normal and tall screens get a
 * 3-line textarea for comfortable multi-line editing.
 */
function useInputRows(): number {
  const [rows, setRows] = useState(() => computeInputRows());
  useEffect(() => {
    const onResize = () => setRows(computeInputRows());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return rows;
}

function computeInputRows(): number {
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  // 500px is roughly the height where a single-line input is needed to keep
  // the conversation readable in landscape / split views.
  return h < 500 ? 1 : 3;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 16,
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 12px",
    backgroundColor: "#f8f8f8",
    borderBottom: "1px solid #e5e5e5",
  },
  backButton: {
    background: "none",
    border: "none",
    fontSize: 22,
    color: "#007AFF",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    color: "#666",
    textTransform: "capitalize",
  },
  reconnect: {
    background: "none",
    border: "none",
    color: "#007AFF",
    fontSize: 13,
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0",
  },
  userEcho: {
    opacity: 0.6,
  },
  thinking: {
    padding: "6px 14px",
    color: "#999",
    fontSize: 16,
  },
  error: {
    margin: "8px 12px",
    padding: "8px 12px",
    backgroundColor: "#fdecea",
    color: "#c62828",
    borderRadius: 8,
    fontSize: 13,
  },
  inputArea: {
    margin: "0 12px 12px",
    border: "1px solid #d1d1d1",
    borderRadius: 16,
    backgroundColor: "#fff",
    // overflow must be visible so the CommandSuggest popover (positioned
    // above via bottom:100%) is not clipped.
    overflow: "visible",
  },
  inputDock: {
    margin: "0 12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  queueRow: {
    padding: "6px 10px 0",
  },
  queueBadge: {
    fontSize: 11,
    color: "#f5a623",
    fontFamily: "ui-monospace, monospace",
  },
  inputWrap: {
    position: "relative",
    display: "block",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    borderRadius: 0,
    padding: "10px 14px",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    resize: "none",
    maxHeight: 120,
    background: "transparent",
  },
  inputToolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px 6px 10px",
    borderTop: "1px solid #f0f0f0",
    minHeight: 32,
  },
  sendButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    width: 28,
    minWidth: 28,
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  },
  sendDisabled: {
    backgroundColor: "#b3d7ff",
    cursor: "not-allowed",
  },
  stopButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    width: 36,
    minWidth: 36,
    backgroundColor: "#ff3b30",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    color: "#999",
    border: "1px solid #e0e0e0",
    borderRadius: 6,
    cursor: "pointer",
    padding: "2px 6px",
    marginLeft: "auto",
  },
  metaBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
    minWidth: 0,
  },
  metaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#888",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    backgroundColor: "#f4f4f5",
    padding: "2px 8px",
    borderRadius: 10,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metaIcon: {
    flexShrink: 0,
    opacity: 0.7,
  },
  button: {
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    cursor: "pointer",
  },
  muted: {
    color: "#999",
  },
};
