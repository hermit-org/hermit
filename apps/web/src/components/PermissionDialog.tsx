import React from "react";
import { useTranslation } from "react-i18next";
import { usePermissionStore, type PendingPermission } from "../stores";
import type { ToolCallContent } from "@hermit/acp";

/**
 * Renders any pending `session/request_permission` requests as modal dialogs.
 *
 * The agent asks the user to approve a tool call; the user picks one of the
 * offered options (allow once / always, reject once / always). Until the user
 * responds, the agent's prompt turn is blocked, so the dialog is non-dismissable
 * except via the explicit "reject"/"dismiss" actions.
 */
/**
 * Renders any pending `session/request_permission` requests.
 *
 * By default these are shown as a modal overlay. Pass `inline` to render
 * them as stacked cards (e.g. docked above the input) without the overlay,
 * so the prompt UI stays attached to the composer.
 */
export function PermissionDialog({
  inline = false,
}: {
  inline?: boolean;
} = {}): React.JSX.Element | null {
  const pending = usePermissionStore((s) => s.pending);
  if (pending.length === 0) return null;
  if (inline) {
    return (
      <div style={styles.inlineStack}>
        {pending.map((entry) => (
          <PermissionCard key={entry.id} entry={entry} />
        ))}
      </div>
    );
  }
  return (
    <div style={styles.overlay}>
      {pending.map((entry) => (
        <PermissionCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function PermissionCard({ entry }: { entry: PendingPermission }): React.JSX.Element {
  const { t } = useTranslation();
  const respond = usePermissionStore((s) => s.respond);
  const cancel = usePermissionStore((s) => s.cancel);

  const tc = entry.toolCall;
  const kind = tc.kind ?? "tool";
  const title = tc.title ?? tc.toolCallId;
  const summary = summarizeToolCall(tc.content ?? [], tc.rawInput);

  const buttons = entry.options.map((opt) => {
    const style = buttonStyleForKind(opt.kind);
    return (
      <button
        key={opt.optionId}
        style={{ ...styles.button, ...style }}
        onClick={() => respond(entry.id, opt.optionId)}
      >
        {opt.name}
      </button>
    );
  });

  return (
    <div style={styles.card} role="dialog" aria-modal="true">
      <div style={styles.header}>
        <span style={styles.badge}>{kind}</span>
        <span style={styles.title}>{t("permission.title")}</span>
      </div>
      <div style={styles.body}>
        <div style={styles.toolTitle}>{title}</div>
        {summary && (
          <pre style={styles.summary}>
            <code>{summary}</code>
          </pre>
        )}
      </div>
      <div style={styles.actions}>
        {buttons}
        <button style={styles.dismissButton} onClick={() => cancel(entry.id)}>
          {t("permission.dismiss")}
        </button>
      </div>
    </div>
  );
}

function buttonStyleForKind(kind: string | undefined): React.CSSProperties {
  switch (kind) {
    case "allow_once":
      return { backgroundColor: "#34a853", color: "#fff" };
    case "allow_always":
      return { backgroundColor: "#0b8043", color: "#fff" };
    case "reject_once":
      return { backgroundColor: "#ea4335", color: "#fff" };
    case "reject_always":
      return { backgroundColor: "#b3261e", color: "#fff" };
    default:
      return {};
  }
}

/** Build a short, readable preview of what the tool is about to do. */
function summarizeToolCall(
  content: ToolCallContent[],
  rawInput: unknown,
): string | null {
  // Prefer rawInput for execute tools (command JSON etc.).
  const raw = formatRaw(rawInput);
  if (raw) return raw;

  // Fall back to text content blocks.
  const texts = content
    .map((c) => (c.type === "content" && c.content.type === "text" ? c.content.text : null))
    .filter((s): s is string => !!s);
  if (texts.length > 0) return texts.join("\n");
  return null;
}

function formatRaw(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        // fall through
      }
    }
    return value;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return null;
    }
  }
  return String(value);
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  },
  inlineStack: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    borderBottom: "1px solid #eee",
  },
  badge: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#666",
    backgroundColor: "#eee",
    padding: "2px 8px",
    borderRadius: 4,
    fontWeight: 600,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1f2328",
  },
  body: {
    padding: "14px 16px",
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 8,
    color: "#1f2328",
  },
  summary: {
    margin: 0,
    padding: 10,
    backgroundColor: "#f6f8fa",
    border: "1px solid #e3e3e3",
    borderRadius: 8,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.5,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#1f2328",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "12px 16px",
    borderTop: "1px solid #eee",
    backgroundColor: "#fafbfc",
  },
  button: {
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  dismissButton: {
    backgroundColor: "transparent",
    color: "#666",
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
