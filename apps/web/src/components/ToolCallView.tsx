import React from "react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type {
  ToolCallUpdate,
  ToolCallStatusUpdate,
  ToolCallContent,
  ContentBlock,
} from "@hermit/acp";

/** A logical tool call accumulated from `tool_call` + `tool_call_update`. */
export interface ToolCallState {
  toolCallId: string;
  title?: string;
  kind?: string;
  status?: string;
  content: ToolCallContent[];
  rawInput?: unknown;
  rawOutput?: unknown;
  locations: { path: string; line?: number }[];
}

/**
 * Merge a tool_call / tool_call_update into accumulated state.
 *
 * Per the ACP spec, `content` items in updates are additive. However, some
 * agents (e.g. Codex) stream the raw tool input as a growing text string,
 * re-sending the full accumulated value in each update. Naive appending
 * produces a garbled stack of prefixes (e.g. `{"` → `{"command` → …).
 *
 * To stay robust against both behaviours, text content blocks that are a
 * prefix-extension of the trailing text block replace it instead of
 * duplicating. Non-text content is always appended.
 */
export function mergeToolCall(
  prev: ToolCallState | undefined,
  update: ToolCallUpdate | ToolCallStatusUpdate,
): ToolCallState {
  const base: ToolCallState = prev ?? {
    toolCallId: update.toolCallId,
    content: [],
    locations: [],
  };

  let content = base.content;
  if (update.content && update.content.length > 0) {
    content = [...base.content];
    for (const item of update.content) {
      const last = content[content.length - 1];
      if (
        item.type === "content" &&
        item.content.type === "text" &&
        last?.type === "content" &&
        last.content.type === "text"
      ) {
        const oldText = last.content.text;
        const newText = (item.content as { text: string }).text;
        // Streaming: new text extends (or is extended by) the previous text.
        if (
          newText.length >= oldText.length &&
          newText.startsWith(oldText)
        ) {
          content[content.length - 1] = item;
          continue;
        }
        if (
          oldText.length > newText.length &&
          oldText.startsWith(newText)
        ) {
          // The incoming chunk is shorter (out-of-order / rewind); keep the
          // longer accumulated value and discard the stale fragment.
          continue;
        }
      }
      content.push(item);
    }
  }

  return {
    toolCallId: update.toolCallId,
    title: update.title ?? base.title,
    kind: update.kind ?? base.kind,
    status: update.status ?? base.status,
    content,
    rawInput: update.rawInput ?? base.rawInput,
    rawOutput: update.rawOutput ?? base.rawOutput,
    locations: update.locations
      ? [...base.locations, ...update.locations]
      : base.locations,
  };
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#999",
  in_progress: "#007AFF",
  completed: "#34a853",
  failed: "#ea4335",
};

export function ToolCallView({ call }: { call: ToolCallState }): React.JSX.Element {
  const { t } = useTranslation();
  const statusColor = STATUS_COLOR[call.status ?? "pending"] ?? "#999";
  const rawInputView = renderRawJson(call.rawInput);
  const rawOutputView = renderRawJson(call.rawOutput);
  const [collapsed, setCollapsed] = React.useState(true);

  const hasBody =
    !!rawInputView ||
    !!rawOutputView ||
    call.content.length > 0 ||
    call.locations.length > 0;

  return (
    <div style={styles.card}>
      <div
        style={{ ...styles.header, cursor: hasBody ? "pointer" : "default" }}
        onClick={() => hasBody && setCollapsed((c) => !c)}
      >
        {hasBody && (
          <span style={styles.caret}>{collapsed ? "▸" : "▾"}</span>
        )}
        <span style={styles.kind}>{call.kind ?? t("tool.kind.fallback")}</span>
        <span style={styles.title}>{call.title ?? call.toolCallId}</span>
        <span style={{ ...styles.status, color: statusColor }}>
          {t(`tool.status.${call.status ?? "pending"}` as const)}
        </span>
      </div>
      {!collapsed && (
        <>
          {rawInputView && (
            <div style={styles.rawBlock}>
              <div style={styles.rawLabel}>{t("tool.input")}</div>
              <pre style={styles.rawText}>
                <code>{rawInputView}</code>
              </pre>
            </div>
          )}
          {call.content.length > 0 && (
            <div style={styles.content}>
              {call.content.map((c, i) => (
                <ToolCallContentItem key={i} content={c} />
              ))}
            </div>
          )}
          {rawOutputView && (
            <div style={styles.rawBlock}>
              <div style={styles.rawLabel}>{t("tool.output")}</div>
              <pre style={styles.rawText}>
                <code>{rawOutputView}</code>
              </pre>
            </div>
          )}
          {call.locations.length > 0 && (
            <div style={styles.locations}>
              {call.locations.map((loc, i) => (
                <div key={i} style={styles.location}>
                  {t("fileManager.location", {
                    path: `${loc.path}${loc.line ? `:${loc.line}` : ""}`,
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Render a `rawInput`/`rawOutput` value as something readable. Strings are
 * shown verbatim (they may be JSON the agent didn't parse); objects are
 * pretty-printed. Returns `null` when there is nothing to show.
 */
function renderRawJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    // Try to pretty-print JSON strings (common for tool inputs/outputs).
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        // fall through to verbatim
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

function ToolCallContentItem({
  content,
}: {
  content: ToolCallContent;
}): React.JSX.Element {
  const { t } = useTranslation();
  if (content.type === "content") {
    return <ContentBlockView content={content.content} />;
  }
  if (content.type === "diff") {
    return (
      <pre style={styles.diff}>
        <code>{generateDiffPreview(content.oldText, content.newText)}</code>
      </pre>
    );
  }
  return <div style={styles.terminal}>{t("terminal.idLabel", { id: content.terminalId })}</div>;
}

function generateDiffPreview(oldText: string | null, newText: string): string {
  const oldLines = (oldText ?? "").split("\n");
  const newLines = newText.split("\n");
  const max = Math.max(oldLines.length, newLines.length);
  const lines: string[] = [];
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      lines.push(`  ${n ?? ""}`);
    } else {
      if (o !== undefined) lines.push(`- ${o}`);
      if (n !== undefined) lines.push(`+ ${n}`);
    }
  }
  return lines.join("\n");
}

function ContentBlockView({
  content,
}: {
  content: ContentBlock;
}): React.JSX.Element {
  const { t } = useTranslation();
  if (content.type === "text") {
    return <MarkdownRenderer content={content.text} />;
  }
  if (content.type === "image") {
    return (
      <img
        style={styles.image}
        src={`data:${content.mimeType};base64,${content.data}`}
        alt=""
      />
    );
  }
  if (content.type === "resource") {
    const r = content.resource;
    if ("text" in r) {
      return (
        <pre style={styles.resource}>
          <code>{r.text}</code>
        </pre>
      );
    }
    return <div style={styles.resource}>{t("resource.binary", { uri: r.uri })}</div>;
  }
  if (content.type === "resource_link") {
    return (
      <div style={styles.resourceLink}>
        🔗 {content.name}{" "}
        <span style={styles.resourceMeta}>{content.mimeType ?? ""}</span>
      </div>
    );
  }
  return <></>;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    margin: "6px 12px",
    padding: "10px 12px",
    backgroundColor: "#fafafa",
    border: "1px solid #ececec",
    borderRadius: 10,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    userSelect: "none",
  },
  caret: {
    fontSize: 11,
    color: "#999",
    width: 12,
    flexShrink: 0,
  },
  kind: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#888",
    backgroundColor: "#eee",
    padding: "2px 6px",
    borderRadius: 4,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
  },
  status: {
    fontSize: 12,
    fontWeight: 600,
  },
  content: {
    fontSize: 14,
  },
  rawBlock: {
    margin: "6px 0",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #e3e3e3",
  },
  rawLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#999",
    backgroundColor: "#f0f0f0",
    padding: "3px 8px",
    borderBottom: "1px solid #e3e3e3",
  },
  rawText: {
    margin: 0,
    padding: 8,
    backgroundColor: "#f6f8fa",
    color: "#1f2328",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.5,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  locations: {
    marginTop: 6,
  },
  location: {
    fontSize: 12,
    color: "#666",
    fontFamily: "ui-monospace, monospace",
  },
  diff: {
    backgroundColor: "#1e1e1e",
    color: "#f8f8f2",
    padding: 10,
    borderRadius: 8,
    overflowX: "auto",
    fontSize: 12,
    margin: "4px 0",
  },
  terminal: {
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    color: "#666",
  },
  image: {
    maxWidth: "100%",
    borderRadius: 8,
  },
  resource: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 8,
    overflowX: "auto",
    fontSize: 12,
    margin: "4px 0",
  },
  resourceLink: {
    fontSize: 13,
    color: "#007aff",
  },
  resourceMeta: {
    color: "#999",
    fontSize: 11,
  },
};
