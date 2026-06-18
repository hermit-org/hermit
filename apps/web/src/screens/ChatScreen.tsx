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
import { SendHorizontal, Cpu, Gauge, Layers, BrainCog } from "lucide-react";
import {
  PlanView,
  ModeView,
} from "../components/SessionMeta";
import { PermissionDialog } from "../components/PermissionDialog";
import { CommandSuggest } from "../components/CommandSuggest";
import { ConfigChip } from "../components/ConfigChip";
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
  const { addMessage, setSessionAcpId } = useSessionStore();

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
  const [configOptions, setConfigOptions] = useState<ConfigOption[]>([]);
  // Usage persists across turns (unlike `turn.usage` which resets on send)
  // so the context-size chip is always visible in the input toolbar.
  const [lastUsage, setLastUsage] = useState<UsageUpdateType | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Accumulates the assistant text for the in-flight turn so `handleSend` can
  // read the latest value after the prompt promise resolves.
  const turnAssistantRef = useRef("");

  // Configurable: how many lines of a thought block to show when collapsed.
  const thoughtPreviewLines = useSettingsStore(
    (s) => s.thoughtPreviewLines,
  );

  // Responsive input sizing: on short screens use a single-line input to
  // maximise message space; otherwise show a 3-line textarea.
  const inputRows = useInputRows();

  const { client, connected, state: connectionState, connect } = useAcpClient({
    gateway: gateway ?? null,
    autoConnect: true,
  });
  const clientRef = useRef<AcpClient | null>(null);
  clientRef.current = client;

  // Establish (or resume) an ACP session once the client is connected.
  // If the local session already has an `acpSessionId` persisted from a
  // previous open, we resume it so the agent's conversation context is
  // preserved. Otherwise we create a new session.
  useEffect(() => {
    if (!client || !connected || acpSessionId) return;
    void (async () => {
      const storedAcpId = session?.acpSessionId;
      try {
        let result;
        if (storedAcpId) {
          // eslint-disable-next-line no-console
          console.debug("[ACP] session/resume:", storedAcpId);
          result = await client.sessionResume({
            sessionId: storedAcpId,
            cwd: "/",
          });
        } else {
          // eslint-disable-next-line no-console
          console.debug("[ACP] session/new");
          result = await client.sessionNew({
            cwd: "/",
          });
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
        }
        const info = client.initializeResult?.agentInfo ?? null;
        // eslint-disable-next-line no-console
        console.debug("[ACP] agentInfo:", info);
        if (info) setAgentInfo(info);
      } catch (e) {
        // If resume fails (e.g. agent restarted, session expired),
        // fall back to creating a fresh session.
        if (storedAcpId) {
          // eslint-disable-next-line no-console
          console.warn("[ACP] resume failed, creating new session:", e);
          try {
            const fresh = await client.sessionNew({ cwd: "/" });
            setAcpSessionId(fresh.sessionId);
            setSessionAcpId(sessionId, fresh.sessionId);
            if (fresh.modes) {
              setMeta((m) => ({ ...m, modes: fresh.modes ?? null }));
            }
            if (fresh.configOptions) {
              setConfigOptions(fresh.configOptions);
            }
            return;
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : String(e2));
            return;
          }
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [client, connected, acpSessionId, session?.acpSessionId, sessionId, setSessionAcpId]);

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
        // Title updates could be persisted; kept as no-op for now.
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
  }, []);

  // Auto-scroll.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turn, localMessages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const client = clientRef.current;
    if (!text || !client || !acpSessionId) return;

    setInput("");
    addMessage(sessionId, "user", text);
    setTurn({ ...EMPTY_TURN, toolCalls: new Map() });
    turnAssistantRef.current = "";
    setBusy(true);
    setError(null);

    try {
      const prompt: ContentBlock[] = [{ type: "text", text }];
      await client.sessionPrompt({ sessionId: acpSessionId, prompt });
      // Persist the final assistant message accumulated during the turn.
      if (turnAssistantRef.current) {
        addMessage(sessionId, "assistant", turnAssistantRef.current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [input, acpSessionId, sessionId, addMessage]);

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
      setConfigOptions((prev) =>
        prev.map((o) =>
          o.id === optionId ? { ...o, currentValue: value } : o,
        ),
      );
      try {
        const result = await client.sessionSetConfigOption({
          sessionId: acpSessionId,
          id: optionId,
          value,
        });
        if (result.configOption) {
          setConfigOptions((prev) =>
            prev.map((o) =>
              o.id === result.configOption!.id ? result.configOption! : o,
            ),
          );
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
    [acpSessionId],
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

  const canSend = connected && !!acpSessionId && !busy;

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
          {acpSessionId ? " · ready" : ""}
          {busy ? " · working" : ""}
        </span>
        {!connected && (
          <button style={styles.reconnect} onClick={connect}>
            {t("chat.reconnect")}
          </button>
        )}
      </div>

      {meta.modes && <ModeView modes={meta.modes} />}

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

        {turn.plan && <PlanView entries={turn.plan} />}

        {busy && turn.items.length === 0 && (
          <div style={styles.thinking}>▋</div>
        )}
        {error && <div style={styles.error}>⚠ {error}</div>}
      </div>

      <div style={styles.inputArea}>
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
                void handleSend();
              }
            }}
            rows={inputRows}
          />
        </div>
        <div style={styles.inputToolbar}>
          <div style={styles.metaBar}>
            {usage && (
              <span style={styles.metaChip} title="Context tokens used / size">
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
        </div>
      </div>

      <PermissionDialog />
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
