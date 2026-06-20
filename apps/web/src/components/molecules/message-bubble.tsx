import * as React from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { StreamingText } from "@/components/streaming-text";
import { AvatarAtom, Timestamp, CopyButton, Spinner } from "@/components/atoms";
import type { AvatarRole } from "@/components/atoms";
import { cn } from "@/lib/utils";

export interface MessageBubbleProps {
  /** Stable message id. */
  id: string;
  /** Speaker role. */
  role: AvatarRole;
  /** Message body (markdown for assistant/system, plain text for user). */
  content: string;
  /** Whether the message is actively streaming. */
  streaming?: boolean;
  /** Display name for the avatar fallback. */
  authorName?: string;
  /** Optional avatar image URL. */
  authorAvatar?: string;
  /** Creation timestamp. */
  createdAt?: number | string | Date;
  /** Render the content as markdown (default true for assistant/system). */
  markdown?: boolean;
  /** Optional status node rendered under the bubble (e.g. thinking). */
  status?: React.ReactNode;
  /** Show a spinner instead of content (e.g. waiting for first chunk). */
  pending?: boolean;
  className?: string;
  /** Fired when the copy button is pressed. */
  onCopy?: (value: string) => void;
}

/**
 * A single chat message bubble with avatar, streaming content, timestamp, and
 * a copy action.
 *
 * @example
 * <MessageBubble role="assistant" content="Hello" streaming createdAt={Date.now()} />
 */
export function MessageBubble({
  role,
  content,
  streaming,
  authorName,
  authorAvatar,
  createdAt,
  markdown = role !== "user",
  status,
  pending,
  className,
  onCopy,
}: MessageBubbleProps): React.JSX.Element {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "group flex w-full gap-3 px-4 py-3",
        isUser && "flex-row-reverse",
        className,
      )}
    >
      <AvatarAtom
        role={role}
        name={authorName}
        src={authorAvatar}
        size={32}
        className="mt-0.5 shrink-0"
      />
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-1",
          isUser && "items-end",
        )}
      >
        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2 text-sm shadow-sm ring-1 ring-inset ring-border",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-card text-card-foreground",
          )}
        >
          {pending ? (
            <div className="flex items-center gap-2 py-0.5 text-muted-foreground">
              <Spinner size={14} />
              <span className="text-xs">Thinking…</span>
            </div>
          ) : markdown ? (
            <div className="markdown-body relative">
              <MarkdownRenderer content={content} />
              {streaming ? (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret-blink bg-foreground align-middle"
                />
              ) : null}
            </div>
          ) : (
            <StreamingText
              text={content}
              streaming={streaming}
              className="whitespace-pre-wrap break-words"
            />
          )}
          {!streaming && content ? (
            <div
              className={cn(
                "absolute -bottom-2 flex opacity-0 transition-opacity group-hover:opacity-100",
                isUser ? "left-0" : "right-0",
              )}
            >
              <CopyButton
                value={content}
                onCopied={onCopy}
                className={cn(
                  "bg-background/80 backdrop-blur",
                  isUser ? "text-primary-foreground" : undefined,
                )}
              />
            </div>
          ) : null}
        </div>
        {status ? <div className="px-1">{status}</div> : null}
        {createdAt ? (
          <Timestamp
            value={createdAt}
            className={cn("px-1", isUser && "text-right")}
          />
        ) : null}
      </div>
    </div>
  );
}
