import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { ToolStatusIcon, CopyButton } from "@/components/atoms";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { cn } from "@/lib/utils";
import type {
  ToolCallState,
  ToolCallContent,
  ContentBlock,
  ToolCallStatus,
} from "@/components/domain";

export interface ToolCallCardProps {
  /** Accumulated tool-call state. */
  call: ToolCallState;
  /** Default collapsed state. */
  defaultCollapsed?: boolean;
  /** Controlled collapsed state. */
  collapsed?: boolean;
  /** Fired when collapsed changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

const STATUS_TONE: Record<ToolCallStatus, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-500",
  completed: "text-success",
  failed: "text-destructive",
};

/**
 * Collapsible tool-call card showing status, title, kind, and (expanded)
 * input/output, content blocks, diffs, and file locations.
 *
 * @example
 * <ToolCallCard call={call} defaultCollapsed />
 */
export function ToolCallCard({
  call,
  defaultCollapsed = true,
  collapsed,
  onCollapsedChange,
  className,
}: ToolCallCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [internal, setInternal] = React.useState(defaultCollapsed);
  const isControlled = collapsed !== undefined;
  const isCollapsed = isControlled ? collapsed : internal;

  const input = renderRaw(call.rawInput);
  const output = renderRaw(call.rawOutput);
  const hasBody =
    !!input ||
    !!output ||
    call.content.length > 0 ||
    call.locations.length > 0;

  const toggle = React.useCallback(() => {
    if (!hasBody) return;
    if (isControlled) {
      onCollapsedChange?.(!collapsed);
    } else {
      setInternal((c) => {
        const next = !c;
        onCollapsedChange?.(next);
        return next;
      });
    }
  }, [hasBody, isControlled, collapsed, onCollapsedChange]);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div
        role={hasBody ? "button" : undefined}
        tabIndex={hasBody ? 0 : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (hasBody && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={hasBody ? !isCollapsed : undefined}
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          hasBody && "cursor-pointer hover:bg-accent/50",
        )}
      >
        {hasBody ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              !isCollapsed && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <ToolStatusIcon status={call.status} size={15} />
        {call.kind ? (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide">
            {call.kind}
          </Badge>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {call.title ?? call.toolCallId}
        </span>
        {call.status ? (
          <span
            className={cn(
              "text-xs font-semibold capitalize",
              STATUS_TONE[call.status],
            )}
          >
            {t(`tool.status.${call.status}` as const)}
          </span>
        ) : null}
      </div>

      {!isCollapsed && hasBody ? (
        <div className="space-y-2 border-t border-border px-3 py-2 text-sm">
          {input ? (
            <RawBlock label={t("tool.input")} value={input} />
          ) : null}
          {call.content.length > 0 ? (
            <div className="space-y-2">
              {call.content.map((c, i) => (
                <ToolCallContentItem key={i} content={c} />
              ))}
            </div>
          ) : null}
          {call.locations.length > 0 ? (
            <div className="space-y-1">
              {call.locations.map((loc, i) => (
                <div
                  key={i}
                  className="font-mono text-xs text-muted-foreground"
                >
                  📄 {loc.path}
                  {loc.line ? `:${loc.line}` : ""}
                </div>
              ))}
            </div>
          ) : null}
          {output ? (
            <RawBlock label={t("tool.output")} value={output} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RawBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <CopyButton value={value} size={12} className="h-5 w-5" />
      </div>
      <pre className="max-h-64 overflow-auto bg-secondary/40 p-2 text-xs leading-relaxed">
        <code className="whitespace-pre-wrap break-words font-mono">
          {value}
        </code>
      </pre>
    </div>
  );
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
      <pre className="overflow-auto rounded-md bg-secondary p-2 text-xs">
        <code className="whitespace-pre font-mono">
          {generateDiffPreview(content.oldText, content.newText)}
        </code>
      </pre>
    );
  }
  return (
    <div className="text-xs text-muted-foreground">
      {t("terminal.idLabel", { id: content.terminalId })}
    </div>
  );
}

function ContentBlockView({
  content,
}: {
  content: ContentBlock;
}): React.JSX.Element | null {
  if (content.type === "text") {
    return (
      <div className="markdown-body text-sm">
        <MarkdownRenderer content={content.text} />
      </div>
    );
  }
  if (content.type === "image") {
    return (
      <img
        className="max-w-full rounded-md"
        src={`data:${content.mimeType};base64,${content.data}`}
        alt=""
      />
    );
  }
  if (content.type === "resource") {
    const r = content.resource;
    if ("text" in r) {
      return (
        <pre className="overflow-auto rounded-md bg-secondary p-2 text-xs">
          <code className="font-mono">{r.text}</code>
        </pre>
      );
    }
    return (
      <div className="text-xs text-muted-foreground">
        [binary resource {r.uri}]
      </div>
    );
  }
  if (content.type === "resource_link") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-500">
        🔗 {content.name}
        {content.mimeType ? (
          <span className="text-muted-foreground">{content.mimeType}</span>
        ) : null}
      </div>
    );
  }
  if (content.type === "audio") {
    return (
      <audio
        controls
        src={`data:${content.mimeType};base64,${content.data}`}
        className="max-w-full"
      />
    );
  }
  return null;
}

function renderRaw(value: unknown): string | null {
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
