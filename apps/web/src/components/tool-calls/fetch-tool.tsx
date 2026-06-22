import * as React from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./shell";
import { CodeBlock, RawBlock } from "./parts";
import { asObject, firstString, getNumber, renderRaw } from "./helpers";

/** Tone an HTTP status code badge by its class. */
function statusTone(status: number): string {
  if (status >= 200 && status < 300) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status >= 300 && status < 400) {
    return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (status >= 400) {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  return "bg-muted text-muted-foreground";
}

/**
 * Specialized renderer for `fetch` tool calls. Shows the URL (and method) in
 * the header summary; reveals the status badge and response body in the body.
 */
export function FetchTool({
  call,
}: {
  call: ToolCallState;
}): React.JSX.Element {
  const { t } = useTranslation();
  const input = asObject(call.rawInput);
  const output = asObject(call.rawOutput);
  const url = firstString(input, "url", "uri", "endpoint");
  const method = (firstString(input, "method") ?? "GET").toUpperCase();
  const status =
    getNumber(output, "status") ??
    getNumber(output, "statusCode") ??
    getNumber(output, "code");

  const responseText =
    firstString(output, "body", "text", "response", "data", "content") ??
    // Plain text content from content blocks.
    call.content
      .filter(
        (c): c is Extract<typeof c, { type: "content" }> =>
          c.type === "content" && c.content.type === "text",
      )
      .map((c) => (c.content as { text: string }).text)
      .join("\n");

  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);
  const hasBody =
    !!url ||
    !!responseText ||
    !!rawInput ||
    !!rawOutput ||
    call.content.length > 0;

  const summary = (
    <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
      <Badge
        variant="outline"
        className="shrink-0 border-transparent bg-muted px-1.5 py-0 text-[10px] font-semibold"
      >
        {method}
      </Badge>
      {url ? (
        <span className="flex min-w-0 items-center gap-1 truncate text-xs text-cyan-700 dark:text-cyan-400">
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{url}</span>
        </span>
      ) : null}
      {status !== undefined ? (
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 border-transparent px-1.5 py-0 text-[10px] font-semibold",
            statusTone(status),
          )}
        >
          {status}
        </Badge>
      ) : null}
    </span>
  );

  return (
    <ToolCallShell call={call} summary={summary} hasBody={hasBody}>
      {url ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
          <Badge
            variant="outline"
            className="shrink-0 border-transparent bg-muted px-1.5 py-0 text-[10px] font-semibold"
          >
            {method}
          </Badge>
          <span className="min-w-0 truncate font-mono text-cyan-700 dark:text-cyan-400">
            {url}
          </span>
        </div>
      ) : null}
      {responseText ? (
        <CodeBlock value={responseText} label={t("tool.fetch.response")} />
      ) : null}
      {rawInput ? <RawBlock label={t("tool.input")} value={rawInput} /> : null}
      {rawOutput ? <RawBlock label={t("tool.output")} value={rawOutput} /> : null}
    </ToolCallShell>
  );
}
