import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { CopyButton } from "@/components/atoms";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { cn } from "@/lib/utils";
import type {
  ContentBlock,
  ToolCallContent,
  ToolCallStatus,
} from "@/components/domain";

const STATUS_TONE: Record<ToolCallStatus, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-500",
  completed: "text-success",
  failed: "text-destructive",
};

export { STATUS_TONE };

/** A labeled, collapsible wrapper for a raw JSON / text value. */
export function RawBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      <div className="flex items-center justify-between border-b border-border bg-muted px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <CopyButton value={value} size={12} className="h-5 w-5" />
      </div>
      <pre className="max-h-64 overflow-auto bg-secondary/40 p-2 text-xs leading-relaxed">
        <code className="whitespace-pre-wrap break-words font-mono">{value}</code>
      </pre>
    </div>
  );
}

interface DiffLine {
  type: "context" | "add" | "remove";
  text: string;
}

/** Compute a minimal line-by-line diff for an edit content block. */
export function computeDiffLines(oldText: string | null, newText: string): DiffLine[] {
  const oldLines = (oldText ?? "").split("\n");
  const newLines = newText.split("\n");
  const max = Math.max(oldLines.length, newLines.length);
  const lines: DiffLine[] = [];
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      lines.push({ type: "context", text: n ?? "" });
    } else {
      if (o !== undefined) lines.push({ type: "remove", text: o });
      if (n !== undefined) lines.push({ type: "add", text: n });
    }
  }
  return lines;
}

/** Count added/removed lines for diff summaries. */
export function countDiff(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added++;
    else if (l.type === "remove") removed++;
  }
  return { added, removed };
}

/** A syntax-highlighted single-file diff view (red/green lines). */
export function DiffView({
  oldText,
  newText,
  className,
}: {
  oldText: string | null;
  newText: string;
  className?: string;
}): React.JSX.Element {
  const lines = React.useMemo(
    () => computeDiffLines(oldText, newText),
    [oldText, newText],
  );
  return (
    <pre
      className={cn(
        "max-h-80 overflow-auto rounded-md border border-border bg-secondary/40 p-0 text-xs leading-relaxed",
        className,
      )}
    >
      <code className="block font-mono">
        {lines.map((line, i) => (
          <span
            key={i}
            className={cn(
              "block whitespace-pre-wrap break-words px-2",
              line.type === "add" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              line.type === "remove" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
            )}
          >
            <span className="select-none opacity-60">
              {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
            </span>
            {line.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

/** A monospaced code/text block with a copy button and optional path header. */
export function CodeBlock({
  value,
  label,
  className,
  maxLines,
}: {
  value: string;
  label?: React.ReactNode;
  className?: string;
  maxLines?: number;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-secondary/40",
        className,
      )}
    >
      {label ? (
        <div className="flex items-center justify-between border-b border-border bg-muted px-2 py-1">
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {label}
          </span>
          <CopyButton value={value} size={12} className="h-5 w-5" />
        </div>
      ) : null}
      <pre
        className={cn("overflow-auto p-2 text-xs leading-relaxed", maxLines && "max-h-80")}
      >
        <code className="whitespace-pre-wrap break-words font-mono">{value}</code>
      </pre>
    </div>
  );
}

/** Render any ACP content block (text/image/resource/etc). */
export function ContentBlockView({
  content,
}: {
  content: ContentBlock;
}): React.JSX.Element | null {
  const { t } = useTranslation();
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
      return <CodeBlock value={r.text} />;
    }
    return (
      <div className="text-xs text-muted-foreground">
        {t("resource.binary", { uri: r.uri })}
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

/** Render a single tool-call content entry (content / diff / terminal). */
export function ToolCallContentItem({
  content,
}: {
  content: ToolCallContent;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  if (content.type === "content") {
    return <ContentBlockView content={content.content} />;
  }
  if (content.type === "diff") {
    return <DiffView oldText={content.oldText} newText={content.newText} />;
  }
  return (
    <div className="text-xs text-muted-foreground">
      {t("terminal.idLabel", { id: content.terminalId })}
    </div>
  );
}

/** A small labeled value row used in metadata summaries. */
export function MetaRow({
  label,
  children,
  mono = true,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("min-w-0 truncate text-xs", mono && "font-mono")}>
        {children}
      </span>
    </div>
  );
}

/** Re-export ChevronRight so shells share the same chevron treatment. */
export function CollapseChevron({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <ChevronRight
      className={cn(
        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
        open && "rotate-90",
        className,
      )}
    />
  );
}
