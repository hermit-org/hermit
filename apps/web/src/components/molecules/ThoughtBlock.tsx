import * as React from "react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ToolCallShell } from "@/components/tool-calls";
import type { ToolCallState } from "@/components/domain";

interface ThoughtBlockProps {
  content: string;
  streaming?: boolean;
}

/**
 * An agent reasoning/thought block embedded in the transcript. Rendered as a
 * tool-call-style card (consistent with execute/bash tool calls) and collapsed
 * by default.
 */
export function ThoughtBlock({
  content,
  streaming,
}: ThoughtBlockProps): React.JSX.Element {
  const { t } = useTranslation();
  const call = React.useMemo<ToolCallState>(
    () => ({
      toolCallId: "thought",
      kind: "think",
      status: streaming ? "in_progress" : "completed",
      title: t("common.thinking"),
      content: [],
      locations: [],
    }),
    [streaming, t],
  );

  return (
    <ToolCallShell call={call} hasBody={!!content}>
      <div className="markdown-body text-xs text-muted-foreground">
        <MarkdownRenderer content={content} />
      </div>
    </ToolCallShell>
  );
}
