import * as React from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { FileIcon } from "@/components/atoms";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./shell";
import { extractDeletedPaths, basename } from "./helpers";

/**
 * Specialized renderer for `delete` tool calls. Summarizes the number of
 * removed paths; lists each path with a destructive tone in the body.
 */
export function DeleteTool({
  call,
}: {
  call: ToolCallState;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { paths } = React.useMemo(() => extractDeletedPaths(call), [call]);
  const hasBody = paths.length > 0 || call.content.length > 0;

  const summary = paths.length > 0 ? (
    <Badge
      variant="outline"
      className="shrink-0 border-transparent bg-rose-500/10 px-1.5 py-0 text-[10px] font-semibold text-rose-700 dark:text-rose-300"
    >
      {paths.length}
    </Badge>
  ) : null;

  return (
    <ToolCallShell
      call={call}
      summary={summary}
      hasBody={hasBody}
      className={cn(
        paths.length > 0 && call.status === "completed" &&
          "border-rose-500/30",
      )}
    >
      {paths.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("tool.delete.deleted")} ({paths.length})
          </div>
          {paths.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md bg-rose-500/5 px-2 py-1 font-mono text-xs text-rose-700 dark:text-rose-300"
            >
              <Trash2 className="h-3 w-3 shrink-0" />
              <FileIcon name={basename(p)} size={12} />
              <span className="truncate">{p}</span>
            </div>
          ))}
        </div>
      ) : null}
      {call.content.length > 0 ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          {call.content.map((c, i) => {
            if (c.type === "content" && c.content.type === "text") {
              return <div key={i}>{(c.content as { text: string }).text}</div>;
            }
            return null;
          })}
        </div>
      ) : null}
    </ToolCallShell>
  );
}
