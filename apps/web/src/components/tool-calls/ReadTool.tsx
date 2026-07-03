import * as React from "react";
import { useTranslation } from "react-i18next";
import { FileIcon } from "@/components/atoms";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./Shell";
import {
  CodeBlock,
  RawBlock,
  ToolCallContentItem,
  MetaRow,
} from "./Parts";
import { asObject, firstString, getNumber, renderRaw, basename } from "./helpers";

/**
 * Specialized renderer for `read` tool calls. Shows the file path(s) and line
 * range in the header summary; reveals the file content in the body.
 */
export function ReadTool({ call }: { call: ToolCallState }): React.JSX.Element {
  const { t } = useTranslation();
  const input = asObject(call.rawInput);
  const path =
    firstString(input, "path", "file", "file_path") ??
    call.locations[0]?.path;
  const startLine = getNumber(input, "line");
  const limit = getNumber(input, "limit");

  // Plain text content (file contents are commonly delivered as a text block).
  const textContent = call.content
    .filter(
      (c): c is Extract<typeof c, { type: "content" }> =>
        c.type === "content" && c.content.type === "text",
    )
    .map((c) => (c.content as { text: string }).text)
    .join("\n");

  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);

  const summary = path ? (
    <span className="hidden min-w-0 items-center gap-1 truncate font-mono text-xs text-muted-foreground sm:flex">
      <FileIcon name={basename(path)} size={12} />
      <span className="truncate">{path}</span>
      {startLine ? `:${startLine}` : ""}
    </span>
  ) : null;

  return (
    <ToolCallShell
      call={call}
      summary={summary}
      hasBody={!!rawInput || !!rawOutput || call.content.length > 0}
    >
      {path ? (
        <MetaRow label="path">
          {path}
          {startLine ? `:${startLine}` : ""}
          {limit ? ` (+${limit})` : ""}
        </MetaRow>
      ) : null}
      {call.content.length > 0 ? (
        <div className="space-y-2">
          {call.content.map((c, i) => (
            <ToolCallContentItem key={i} content={c} />
          ))}
        </div>
      ) : null}
      {textContent ? (
        <CodeBlock value={textContent} label={path ?? t("tool.read.fileContent")} />
      ) : null}
      {rawInput ? <RawBlock label={t("tool.input")} value={rawInput} /> : null}
      {rawOutput ? <RawBlock label={t("tool.output")} value={rawOutput} /> : null}
    </ToolCallShell>
  );
}
