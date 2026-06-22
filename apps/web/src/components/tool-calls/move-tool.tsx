import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { FileIcon } from "@/components/atoms";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./shell";
import { RawBlock } from "./parts";
import { extractMovePaths, renderRaw, basename } from "./helpers";

/**
 * Specialized renderer for `move` tool calls. Shows source → target in the
 * header summary and a visual arrow mapping in the body.
 */
export function MoveTool({ call }: { call: ToolCallState }): React.JSX.Element {
  const { t } = useTranslation();
  const { source, target } = React.useMemo(() => extractMovePaths(call), [call]);
  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);
  const hasBody =
    !!source ||
    !!target ||
    !!rawInput ||
    !!rawOutput ||
    call.content.length > 0;

  const summary =
    source || target ? (
      <span className="hidden min-w-0 items-center gap-1 truncate text-xs text-muted-foreground sm:flex">
        {source ? (
          <span className="flex min-w-0 items-center gap-1 truncate font-mono">
            <FileIcon name={basename(source)} size={12} />
            <span className="truncate">{basename(source)}</span>
          </span>
        ) : null}
        <ArrowRight className="h-3 w-3 shrink-0" />
        {target ? (
          <span className="flex min-w-0 items-center gap-1 truncate font-mono">
            <FileIcon name={basename(target)} size={12} />
            <span className="truncate">{basename(target)}</span>
          </span>
        ) : null}
      </span>
    ) : null;

  return (
    <ToolCallShell call={call} summary={summary} hasBody={hasBody}>
      {(source || target) && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/30 p-2 text-xs">
          {source ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="w-8 shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">
                {t("tool.move.from")}
              </span>
              <FileIcon name={basename(source)} size={12} />
              <span className="truncate font-mono">{source}</span>
            </div>
          ) : null}
          {target ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="w-8 shrink-0 text-[10px] font-semibold uppercase text-violet-600 dark:text-violet-400">
                {t("tool.move.to")}
              </span>
              <FileIcon name={basename(target)} size={12} />
              <span className="truncate font-mono text-violet-600 dark:text-violet-400">
                {target}
              </span>
            </div>
          ) : null}
        </div>
      )}
      {rawInput ? <RawBlock label={t("tool.input")} value={rawInput} /> : null}
      {rawOutput ? <RawBlock label={t("tool.output")} value={rawOutput} /> : null}
    </ToolCallShell>
  );
}
