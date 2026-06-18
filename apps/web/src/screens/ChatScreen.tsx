import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGatewayStore, useSessionStore } from "../stores";
import { useAcpClient } from "../acp/hooks";
import { ChatMessage } from "../components/ChatMessage";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import {
  ToolCallView,
  mergeToolCall,
  type ToolCallState,
} from "../components/ToolCallView";
import {
  PlanView,
  UsageView,
  ModeView,
  CommandsView,
} from "../components/SessionMeta";
import type { Gateway, Message } from "../types";
import type {
  SessionUpdate,
  PlanEntry,
  UsageUpdate as UsageUpdateType,
  SessionModeState,
  AvailableCommand,
  ContentBlock,
  AcpClient,
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
  const { addMessage } = useSessionStore();

  const gateway = useGatewayStore((state: { gateways: Gateway[] }) =>
    state.gateways.find((g) => g.id === session?.gatewayId),
  );

  const [input, setInput] = useState("");
  const [turn, setTurn] = useState<TurnState>(EMPTY_TURN);
  const [meta, setMeta] = useState<SessionMeta>({ modes: null, commands: [] });
  const [acpSessionId, setAcpSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Accumulates the assistant text for the in-flight turn so `handleSend` can
  // read the latest value after the prompt promise resolves.
  const turnAssistantRef = useRef("");

  const { client, connected, state: connectionState, connect } = useAcpClient({
    gateway: gateway ?? null,
    autoConnect: true,
  });
  const clientRef = useRef<AcpClient | null>(null);
  clientRef.current = client;

  // Create an ACP session once the client is connected.
  useEffect(() => {
    if (!client || !connected || acpSessionId) return;
    void (async () => {
      try {
        const result = await client.sessionNew({
          cwd: typeof navigator !== "undefined" ? "/" : "/",
        });
        setAcpSessionId(result.sessionId);
        if (result.modes) {
          setMeta((m) => ({ ...m, modes: result.modes ?? null }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [client, connected, acpSessionId]);

  // Subscribe to session/update notifications.
  useEffect(() => {
    if (!client) return;
    return client.onUpdate((update: SessionUpdate) => {
      applyUpdate(update);
    });
  }, [client]);

  const applyUpdate = useCallback((update: SessionUpdate) => {
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
        break;
      case "current_mode_update":
        setMeta((m) => {
          if (!m.modes) return m;
          return { ...m, modes: { ...m.modes, currentModeId: update.modeId } };
        });
        break;
      case "available_commands_update":
        setMeta((m) => ({ ...m, commands: update.availableCommands }));
        break;
      case "session_info_update":
        // Title updates could be persisted; kept as no-op for now.
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
              <div key={`th-${i}`} style={styles.thought}>
                <MarkdownRenderer content={item.content} />
              </div>
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
        {turn.usage && <UsageView usage={turn.usage} />}
        {meta.commands.length > 0 && <CommandsView commands={meta.commands} />}

        {busy && turn.items.length === 0 && (
          <div style={styles.thinking}>▋</div>
        )}
        {error && <div style={styles.error}>⚠ {error}</div>}
      </div>

      <div style={styles.inputRow}>
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
          rows={1}
        />
        <button
          style={{
            ...styles.sendButton,
            ...(!canSend && styles.sendDisabled),
          }}
          onClick={handleSend}
          disabled={!canSend}
        >
          {t("chat.send")}
        </button>
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
  thought: {
    margin: "6px 12px",
    padding: "8px 12px",
    backgroundColor: "#f6f7f9",
    borderLeft: "3px solid #c8c8d0",
    borderRadius: "0 8px 8px 0",
    color: "#777",
    fontSize: 13,
    opacity: 0.9,
  },
  error: {
    margin: "8px 12px",
    padding: "8px 12px",
    backgroundColor: "#fdecea",
    color: "#c62828",
    borderRadius: 8,
    fontSize: 13,
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTop: "1px solid #e5e5e5",
  },
  input: {
    flex: 1,
    border: "1px solid #d1d1d1",
    borderRadius: 20,
    padding: "10px 16px",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    resize: "none",
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    color: "#fff",
    fontWeight: 600,
    border: "none",
    borderRadius: 20,
    padding: "12px 18px",
    cursor: "pointer",
  },
  sendDisabled: {
    backgroundColor: "#b3d7ff",
    cursor: "not-allowed",
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
