import * as React from "react";
import { MessagesSquare, BrainCog } from "lucide-react";
import {
  MessageBubble,
  ToolCallCard,
} from "@/components/molecules";
import {
  ScrollToBottomButton,
  EmptyState,
  Divider,
} from "@/components/atoms";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/components/domain";
import type { AvatarRole } from "@/components/atoms";

/** A renderable item in the chat transcript. */
export type ChatItem =
  | {
      kind: "message";
      key: string;
      role: AvatarRole;
      content: string;
      streaming?: boolean;
      pending?: boolean;
      authorName?: string;
      createdAt: number;
    }
  | {
      kind: "tool_call";
      key: string;
      call: ToolCallState;
    }
  | {
      kind: "thought";
      key: string;
      content: string;
      streaming?: boolean;
    };

export interface ChatAreaProps {
  /** Ordered transcript items (messages + tool calls interleaved). */
  items: ChatItem[];
  /** Whether the transcript is empty. */
  empty?: boolean;
  /** Empty-state title override. */
  emptyTitle?: string;
  /** Empty-state description override. */
  emptyDescription?: React.ReactNode;
  /** Empty-state action. */
  emptyAction?: React.ReactNode;
  /** Name shown for assistant bubbles. */
  assistantName?: string;
  className?: string;
}

function dayBucket(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/**
 * The main chat transcript area. Renders messages and inline tool-call cards,
 * auto-scrolls to the bottom on new content, shows date dividers between
 * days, and surfaces a scroll-to-bottom button when the user scrolls up.
 *
 * @example
 * <ChatArea items={items} />
 */
export function ChatArea({
  items,
  empty,
  emptyTitle = "No messages yet",
  emptyDescription = "Send a message to start the conversation.",
  emptyAction,
  assistantName,
  className,
}: ChatAreaProps): React.JSX.Element {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [unread, setUnread] = React.useState(0);

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = viewportRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
    },
    [],
  );

  const onScroll = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const threshold = 48;
    const isBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAtBottom(isBottom);
    if (isBottom) setUnread(0);
  }, []);

  // Track latest item count to detect growth.
  const lastCountRef = React.useRef(items.length);
  React.useEffect(() => {
    const grew = items.length > lastCountRef.current;
    lastCountRef.current = items.length;
    if (!grew) return;
    if (atBottom) {
      // Defer to allow DOM to paint new content.
      const id = requestAnimationFrame(() => scrollToBottom("auto"));
      return () => cancelAnimationFrame(id);
    }
    setUnread((u) => u + 1);
  }, [items.length, atBottom, scrollToBottom]);

  const showEmpty = empty || items.length === 0;

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <div
          onWheel={onScroll}
          onTouchMove={onScroll}
          className="min-h-full py-4"
        >
          {showEmpty ? (
            <EmptyState
              icon={MessagesSquare}
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-1">
              {items.map((item, i) => {
                const prev = items[i - 1];
                let divider: React.ReactNode = null;
                if (item.kind === "message") {
                  const prevTs =
                    prev && prev.kind === "message" ? prev.createdAt : undefined;
                  if (
                    prevTs === undefined ||
                    dayBucket(prevTs) !== dayBucket(item.createdAt)
                  ) {
                    divider = (
                      <div className="px-4 py-2">
                        <Divider label={dayBucket(item.createdAt)} />
                      </div>
                    );
                  }
                }
                return (
                  <React.Fragment key={item.key}>
                    {divider}
                    {item.kind === "message" ? (
                      <MessageBubble
                        id={item.key}
                        role={item.role}
                        content={item.content}
                        streaming={item.streaming}
                        pending={item.pending}
                        authorName={
                          item.role === "assistant"
                            ? (assistantName ?? "Agent")
                            : item.role === "user"
                              ? "You"
                              : "System"
                        }
                        createdAt={item.createdAt}
                      />
                    ) : item.kind === "tool_call" ? (
                      <div className="px-4 py-1.5">
                        <ToolCallCard call={item.call} />
                      </div>
                    ) : (
                      <ThoughtBlock
                        content={item.content}
                        streaming={item.streaming}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {!atBottom && !showEmpty ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="pointer-events-auto">
            <ScrollToBottomButton
              unreadCount={unread}
              onClick={() => scrollToBottom("smooth")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * An agent reasoning/thought block embedded in the transcript. Collapsed by
 * default; auto-expands while streaming. Click to toggle.
 */
function ThoughtBlock({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const open = expanded || (streaming ?? false);
  return (
    <div className="mx-auto my-1 w-full max-w-3xl px-4">
      <div className="rounded-r-md border-l-2 border-border bg-muted/40 px-3 py-2 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <BrainCog className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-wide">
            Thinking
          </span>
          {streaming ? (
            <span className="animate-pulse text-xs">…</span>
          ) : null}
          <button
            type="button"
            className="ml-auto text-[11px] font-medium text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
        {open ? (
          <div className="markdown-body mt-1 text-xs text-muted-foreground">
            <MarkdownRenderer content={content} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
