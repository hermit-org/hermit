import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { FileIcon } from "@/components/atoms";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./shell";
import { asObject, extractMatches, firstString, basename } from "./helpers";

/**
 * Specialized renderer for `search` tool calls. Summarizes the match count in
 * the header; lists each match (path:line + context snippet) in the body.
 */
export function SearchTool({
  call,
}: {
  call: ToolCallState;
}): React.JSX.Element {
  const { t } = useTranslation();
  const input = asObject(call.rawInput);
  const query =
    firstString(input, "query", "pattern", "regex", "q", "search") ??
    call.title;
  const matches = React.useMemo(
    () => extractMatches(call.rawOutput ?? call.rawInput),
    [call.rawOutput, call.rawInput],
  );
  const hasBody = matches.length > 0 || !!query || call.content.length > 0;

  const summary = (
    <span className="hidden items-center gap-1.5 sm:flex">
      {query ? (
        <code className="max-w-[12rem] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {query}
        </code>
      ) : null}
      {matches.length > 0 ? (
        <Badge
          variant="outline"
          className="shrink-0 border-transparent bg-sky-500/10 px-1.5 py-0 text-[10px] font-semibold text-sky-700 dark:text-sky-300"
        >
          {matches.length}
        </Badge>
      ) : null}
    </span>
  );

  return (
    <ToolCallShell call={call} summary={summary} hasBody={hasBody}>
      {matches.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("tool.search.matches")} ({matches.length})
          </div>
          {matches.map((m, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs"
            >
              <div className="flex min-w-0 items-center gap-1 font-mono text-sky-700 dark:text-sky-300">
                <FileIcon name={basename(m.path)} size={12} />
                <span className="truncate">{m.path}</span>
                {m.line ? <span className="shrink-0">:{m.line}</span> : null}
              </div>
              {m.context ? (
                <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {m.context}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        call.content.length === 0 && (
          <div className="text-xs text-muted-foreground">
            {t("tool.search.noMatches")}
          </div>
        )
      )}
      {call.content.length > 0 ? (
        <div className="space-y-1 text-xs">
          {call.content.map((c, i) => {
            if (c.type === "content" && c.content.type === "text") {
              return (
                <div key={i}>{(c.content as { text: string }).text}</div>
              );
            }
            return null;
          })}
        </div>
      ) : null}
    </ToolCallShell>
  );
}
