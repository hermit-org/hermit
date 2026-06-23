import * as React from "react";
import { ExternalLink, FileText, Music } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { cn } from "@/lib/utils";
import type { ContentBlock } from "@/components/domain";

export interface ContentRendererProps {
  /** The ACP content block to render. */
  content: ContentBlock;
  /** Compact mode for inline rendering (smaller text). */
  compact?: boolean;
  className?: string;
}

/**
 * Routes a single ACP `ContentBlock` to the right renderer: text/Markdown,
 * image, audio, embedded resource, or resource link.
 *
 * @example
 * <ContentRenderer content={block} />
 */
export function ContentRenderer({
  content,
  compact,
  className,
}: ContentRendererProps): React.JSX.Element | null {
  if (content.type === "text") {
    return (
      <div className={cn("markdown-body", compact && "text-sm", className)}>
        <MarkdownRenderer content={content.text} />
      </div>
    );
  }
  if (content.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={cn("max-w-full rounded-md", className)}
        src={`data:${content.mimeType};base64,${content.data}`}
        alt=""
      />
    );
  }
  if (content.type === "audio") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Music className="h-4 w-4 text-muted-foreground" />
        <audio
          controls
          src={`data:${content.mimeType};base64,${content.data}`}
          className="max-w-full"
        />
      </div>
    );
  }
  if (content.type === "resource") {
    const r = content.resource;
    if ("text" in r) {
      return (
        <pre
          className={cn(
            "overflow-auto rounded-md bg-secondary p-2 text-xs",
            className,
          )}
        >
          <code className="font-mono">{r.text}</code>
        </pre>
      );
    }
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        [binary resource {r.uri}]
      </div>
    );
  }
  if (content.type === "resource_link") {
    return (
      <a
        href={content.uri}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline",
          className,
        )}
      >
        <FileText className="h-3.5 w-3.5" />
        {content.name}
        {content.title ? (
          <span className="text-muted-foreground">— {content.title}</span>
        ) : null}
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    );
  }
  return null;
}

/**
 * Render an array of content blocks vertically.
 */
export function ContentBlockList({
  blocks,
  compact,
  className,
}: {
  blocks: ContentBlock[];
  compact?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((block, i) => (
        <ContentRenderer key={contentBlockKey(block, i)} content={block} compact={compact} />
      ))}
    </div>
  );
}

/**
 * Derive a stable key for a content block. Falls back to a combination of
 * type and a content fragment so inserts/reorders don't reuse stale DOM.
 */
function contentBlockKey(block: ContentBlock, index: number): string {
  switch (block.type) {
    case "text":
      return `text:${index}:${block.text.slice(0, 32)}`;
    case "image":
      return `image:${index}:${block.mimeType}`;
    case "audio":
      return `audio:${index}:${block.mimeType}`;
    case "resource":
      return `resource:${index}:${block.resource.uri}`;
    case "resource_link":
      return `resource_link:${index}:${block.uri}`;
    default:
      return `${index}`;
  }
}
