import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/components/domain";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ToolCallShell } from "./Shell";
import { RawBlock } from "./Parts";
import { renderRaw } from "./helpers";

/**
 * Specialized renderer for `think` tool calls. Renders the agent's reasoning as
 * muted markdown (similar to a thought block) inside the body.
 */
export function ThinkTool({ call }: { call: ToolCallState }): React.JSX.Element {
  const { t } = useTranslation();
  const reasoning = React.useMemo(() => {
    return call.content
      .filter(
        (c): c is Extract<typeof c, { type: "content" }> =>
          c.type === "content" && c.content.type === "text",
      )
      .map((c) => (c.content as { text: string }).text)
      .join("\n");
  }, [call.content]);
  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);
  const hasBody =
    !!reasoning || !!rawInput || !!rawOutput || call.content.length > 0;

  return (
    <ToolCallShell
      call={call}
      hasBody={hasBody}
      className={cn("border-purple-500/20 bg-purple-500/[0.03]")}
    >
      {reasoning ? (
        <div className="markdown-body rounded-md border-l-2 border-purple-500/40 bg-purple-500/[0.04] px-3 py-2 text-xs text-muted-foreground">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
            {t("tool.think.reasoning")}
          </div>
          <MarkdownRenderer content={reasoning} />
        </div>
      ) : null}
      {rawInput ? <RawBlock label={t("tool.input")} value={rawInput} /> : null}
      {rawOutput ? <RawBlock label={t("tool.output")} value={rawOutput} /> : null}
    </ToolCallShell>
  );
}
