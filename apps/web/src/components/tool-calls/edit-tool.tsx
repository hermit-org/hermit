import * as React from "react";
import { useTranslation } from "react-i18next";
import { FileIcon } from "@/components/atoms";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolCallContent, ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./shell";
import {
  DiffView,
  RawBlock,
  computeDiffLines,
  countDiff,
} from "./parts";
import { asObject, firstString, renderRaw, basename } from "./helpers";

/** Collect every diff source (content blocks + rawInput) for an edit call. */
function collectDiffs(call: ToolCallState): {
  path?: string;
  oldText: string | null;
  newText: string;
}[] {
  const diffs: {
    path?: string;
    oldText: string | null;
    newText: string;
  }[] = [];

  for (const c of call.content) {
    if (c.type === "diff") {
      diffs.push({
        path: (c as Extract<ToolCallContent, { type: "diff" }>).path,
        oldText: (c as Extract<ToolCallContent, { type: "diff" }>).oldText,
        newText: (c as Extract<ToolCallContent, { type: "diff" }>).newText,
      });
    }
  }

  const input = asObject(call.rawInput);
  const inOld = firstString(input, "oldText", "old_text", "old");
  const inNew = firstString(input, "newText", "new_text", "new");
  const inPath =
    firstString(input, "path", "file", "file_path") ?? call.locations[0]?.path;
  if (inNew !== undefined && diffs.length === 0) {
    diffs.push({ path: inPath, oldText: inOld ?? null, newText: inNew });
  }
  return diffs;
}

/**
 * Specialized renderer for `edit` tool calls. The hero feature is the diff
 * view; the header summary shows the file path and added/removed counts.
 */
export function EditTool({ call }: { call: ToolCallState }): React.JSX.Element {
  const { t } = useTranslation();
  const diffs = React.useMemo(() => collectDiffs(call), [call]);
  const input = asObject(call.rawInput);
  const path =
    firstString(input, "path", "file", "file_path") ??
    diffs[0]?.path ??
    call.locations[0]?.path;

  const totals = React.useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const d of diffs) {
      const c = countDiff(computeDiffLines(d.oldText, d.newText));
      added += c.added;
      removed += c.removed;
    }
    return { added, removed };
  }, [diffs]);

  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);
  const hasBody =
    diffs.length > 0 || !!rawInput || !!rawOutput || call.content.length > 0;

  const summary = (
    <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
      {path ? (
        <span className="flex min-w-0 items-center gap-1 truncate font-mono text-xs text-muted-foreground">
          <FileIcon name={basename(path)} size={12} />
          <span className="truncate">{path}</span>
        </span>
      ) : null}
      {totals.added > 0 || totals.removed > 0 ? (
        <span className="flex shrink-0 items-center gap-1">
          <Badge
            variant="outline"
            className={cn(
              "border-transparent bg-emerald-500/10 px-1 py-0 text-[10px] text-emerald-700 dark:text-emerald-300",
            )}
          >
            +{totals.added}
          </Badge>
          <Badge
            variant="outline"
            className="border-transparent bg-rose-500/10 px-1 py-0 text-[10px] text-rose-700 dark:text-rose-300"
          >
            -{totals.removed}
          </Badge>
        </span>
      ) : null}
    </span>
  );

  return (
    <ToolCallShell call={call} summary={summary} hasBody={hasBody}>
      {diffs.length > 0 ? (
        <div className="space-y-2">
          {diffs.map((d, i) => (
            <div key={i} className="space-y-1">
              {d.path ? (
                <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <FileIcon name={basename(d.path)} size={12} />
                  {d.path}
                </div>
              ) : null}
              <DiffView oldText={d.oldText} newText={d.newText} />
            </div>
          ))}
        </div>
      ) : null}
      {rawInput ? <RawBlock label={t("tool.input")} value={rawInput} /> : null}
      {rawOutput ? <RawBlock label={t("tool.output")} value={rawOutput} /> : null}
    </ToolCallShell>
  );
}
