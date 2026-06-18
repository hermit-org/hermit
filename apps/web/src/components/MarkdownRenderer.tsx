import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

/**
 * Renders markdown content using a standard web markdown stack.
 *
 * Compared to the mobile `react-native-markdown-display`, this uses
 * `react-markdown` + `remark-gfm` which is the idiomatic browser equivalent.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps): React.JSX.Element {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
