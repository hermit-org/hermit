import React, { useMemo } from "react";
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
  // Cache the plugins array so react-markdown doesn't re-initialise the
  // pipeline on every render (important for long documents).
  const remarkPlugins = useMemo(() => [remarkGfm], []);
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
    </div>
  );
}
