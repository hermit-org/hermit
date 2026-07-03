import * as React from "react";
import { useTranslation } from "react-i18next";
import type { ToolCallState } from "@/components/domain";
import { ToolCallShell } from "./Shell";
import { RawBlock, ToolCallContentItem } from "./Parts";
import { renderRaw } from "./helpers";

/**
 * Generic fallback renderer for `other` tool kinds (and any unrecognized kind).
 * Mirrors the behaviour of the original `ToolCallCard`: shows input/output,
 * content blocks, and locations in a collapsible body.
 */
export function OtherTool({
  call,
}: {
  call: ToolCallState;
}): React.JSX.Element {
  const { t } = useTranslation();
  const input = renderRaw(call.rawInput);
  const output = renderRaw(call.rawOutput);
  const hasBody =
    !!input || !!output || call.content.length > 0 || call.locations.length > 0;

  return (
    <ToolCallShell call={call} hasBody={hasBody}>
      {input ? <RawBlock label={t("tool.input")} value={input} /> : null}
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
      {output ? <RawBlock label={t("tool.output")} value={output} /> : null}
    </ToolCallShell>
  );
}
