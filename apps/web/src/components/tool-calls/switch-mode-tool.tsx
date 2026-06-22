import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./shell";
import { RawBlock } from "./parts";
import { asObject, firstString, renderRaw } from "./helpers";

/** Capitalize a mode id for display (e.g. "code" -> "Code"). */
function prettifyMode(id?: string): string | undefined {
  if (!id) return undefined;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Specialized renderer for `switch_mode` tool calls. Shows the previous → next
 * mode transition as the hero element.
 */
export function SwitchModeTool({
  call,
}: {
  call: ToolCallState;
}): React.JSX.Element {
  const { t } = useTranslation();
  const output = asObject(call.rawOutput);
  const next =
    firstString(output, "modeId", "mode", "currentModeId", "newMode") ??
    undefined;
  const prev = firstString(output, "previousModeId", "previousMode", "oldMode");

  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);
  const hasBody = !!next || !!prev || !!rawInput || !!rawOutput;

  const transition = (
    <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
      {prev ? (
        <Badge
          variant="outline"
          className="border-transparent bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {prettifyMode(prev)}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500" />
      {next ? (
        <Badge
          variant="outline"
          className={cn(
            "border-transparent bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300",
          )}
        >
          {prettifyMode(next)}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );

  const summary = (
    <span className="hidden items-center gap-1.5 sm:flex">
      {prev ? (
        <Badge
          variant="outline"
          className="border-transparent bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
        >
          {prettifyMode(prev)}
        </Badge>
      ) : null}
      {prev || next ? <ArrowRight className="h-3 w-3 shrink-0" /> : null}
      {next ? (
        <Badge
          variant="outline"
          className="border-transparent bg-indigo-500/10 px-1.5 py-0 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300"
        >
          {prettifyMode(next)}
        </Badge>
      ) : null}
    </span>
  );

  return (
    <ToolCallShell
      call={call}
      summary={summary}
      hasBody={hasBody}
      defaultCollapsed={false}
    >
      {transition}
      {rawInput ? <RawBlock label={t("tool.input")} value={rawInput} /> : null}
      {rawOutput ? <RawBlock label={t("tool.output")} value={rawOutput} /> : null}
    </ToolCallShell>
  );
}
