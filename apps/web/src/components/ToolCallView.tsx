import React from "react";
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
  locations: { path: string; line?: number }[];
}

export function mergeToolCall(
  prev: ToolCallState | undefined,
  update: ToolCallUpdate | ToolCallStatusUpdate,
): ToolCallState {
  const base: ToolCallState = prev ?? {
    toolCallId: update.toolCallId,
    content: [],
    locations: [],
  };
  return {
    toolCallId: update.toolCallId,
    title: update.title ?? base.title,
    kind: update.kind ?? base.kind,
    status: update.status ?? base.status,
    content: update.content ? [...base.content, ...update.content] : base.content,
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
  const statusColor = STATUS_COLOR[call.status ?? "pending"] ?? "#999";
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.kind}>{call.kind ?? "tool"}</span>
        <span style={styles.title}>{call.title ?? call.toolCallId}</span>
        <span style={{ ...styles.status, color: statusColor }}>
          {call.status ?? "pending"}
        </span>
      </div>
      {call.content.length > 0 && (
        <div style={styles.content}>
          {call.content.map((c, i) => (
            <ToolCallContentItem key={i} content={c} />
          ))}
        </div>
      )}
      {call.locations.length > 0 && (
        <div style={styles.locations}>
          {call.locations.map((loc, i) => (
            <div key={i} style={styles.location}>
              📄 {loc.path}
              {loc.line ? `:${loc.line}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallContentItem({
  content,
}: {
  content: ToolCallContent;
}): React.JSX.Element {
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
  return <div style={styles.terminal}>[terminal {content.terminalId}]</div>;
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
    return <div style={styles.resource}>[binary resource {r.uri}]</div>;
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
