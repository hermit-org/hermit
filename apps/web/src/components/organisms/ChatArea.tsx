import * as React from "react";
import { useTranslation } from "react-i18next";
import { MessagesSquare } from "lucide-react";
import { MessageBubble } from "@/components/molecules";
import { ThoughtBlock } from "@/components/molecules/ThoughtBlock";
import { ToolCallTimeline } from "@/components/organisms/ToolCallTimeline";
import {
  ScrollToBottomButton,
  EmptyState,
  Divider,
} from "@/components/atoms";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { cn } from "@/lib/utils";
import { withFeatureGate } from "@/components/FeatureGate";
import type { ToolCallState } from "@/components/domain";
import type { AvatarRole } from "@/components/atoms";

/** A renderable item in the chat transcript. */
export type ChatItem =
  | {
      kind: "message";
      key: string;
      role: AvatarRole;
      content: string;
      /** Images attached to the message (base64 data + mime type). */
      images?: { data: string; mimeType: string }[];
      streaming?: boolean;
      pending?: boolean;
      authorName?: string;
      createdAt: number;
      /** ACP messageId — used to merge consecutive chunks of the same message. */
      messageId?: string;
    }
  | {
      kind: "tool_call";
      key: string;
      call: ToolCallState;
      createdAt: number;
    }
  | {
      kind: "thought";
      key: string;
      content: string;
      streaming?: boolean;
      messageId?: string;
    }
  | {
      kind: "divider";
      key: string;
      /** Label text for the divider (e.g. "Switched to Agent B"). */
      label: string;
      createdAt: number;
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

function isToday(ts: number): boolean {
  return new Date(ts).toDateString() === new Date().toDateString();
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
  emptyTitle,
  emptyDescription,
  emptyAction,
  assistantName,
  className,
}: ChatAreaProps): React.JSX.Element {
  const { t } = useTranslation();
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

  // Track the viewport scroll position via a native scroll listener so that
  // programmatic scrolling (e.g. `scrollToBottom`) also updates `atBottom`,
  // not just user-initiated wheel/touch gestures. Re-runs if the viewport
  // element identity changes (e.g. StrictMode remount).
  const scrollElRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollElRef.current ?? viewportRef.current;
    if (!el) return;
    scrollElRef.current = el;
    const threshold = 48;
    const handleScroll = () => {
      const isBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setAtBottom(isBottom);
      if (isBottom) setUnread(0);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  });

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

  // Show a single "Today" divider between older history and today's messages.
  // Only displayed when today's first message is preceded by older messages —
  // if the transcript opens on today, no divider is needed.
  const todayDividerIndex = React.useMemo(() => {
    let seenOlder = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "message") continue;
      if (isToday(item.createdAt)) {
        return seenOlder ? i : -1;
      }
      seenOlder = true;
    }
    return -1;
  }, [items]);

  const showEmpty = empty || items.length === 0;
  const resolvedEmptyTitle = emptyTitle ?? t("chat.noMessages");
  const resolvedEmptyDescription =
    emptyDescription ?? t("chat.startConversation");

  // Group consecutive tool_call/thought items into a single timeline panel.
  // Messages are rendered individually as bubbles and dividers remain as
  // standalone separators.
  const groups = React.useMemo(() => {
    const result: (
      | { type: "message"; item: ChatItem & { kind: "message" }; index: number }
      | {
          type: "timeline";
          items: (ChatItem & { kind: "tool_call" | "thought" })[];
          startIndex: number;
        }
      | { type: "divider"; item: ChatItem & { kind: "divider" }; index: number }
    )[] = [];
    const timeline: (ChatItem & { kind: "tool_call" | "thought" })[] = [];

    const flushTimeline = (beforeIndex: number) => {
      if (timeline.length === 0) return;
      result.push({
        type: "timeline",
        items: [...timeline],
        startIndex: beforeIndex - timeline.length,
      });
      timeline.length = 0;
    };

    items.forEach((item, index) => {
      if (item.kind === "message") {
        flushTimeline(index);
        result.push({ type: "message", item, index });
      } else if (item.kind === "tool_call" || item.kind === "thought") {
        timeline.push(item);
      } else if (item.kind === "divider") {
        flushTimeline(index);
        result.push({ type: "divider", item, index });
      }
    });

    flushTimeline(items.length);

    return result;
  }, [items]);

  return (
    <div className={cn("relative flex h-full flex-col", className)} data-testid="chat-area">
      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <div className="min-h-full py-4">
          {showEmpty ? (
            <EmptyState
              icon={MessagesSquare}
              title={resolvedEmptyTitle}
              description={resolvedEmptyDescription}
              action={emptyAction}
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-1">
              {groups.map((group) => {
                if (group.type === "message") {
                  const { item, index } = group;
                  const showTodayDivider = index === todayDividerIndex;
                  return (
                    <React.Fragment key={item.key}>
                      {showTodayDivider ? (
                        <div className="px-4 py-2">
                          <Divider label={t("common.today")} />
                        </div>
                      ) : null}
                      <MessageBubble
                        id={item.key}
                        role={item.role}
                        content={item.content}
                        images={item.images}
                        streaming={item.streaming}
                        pending={item.pending}
                        authorName={
                          item.role === "assistant"
                            ? (assistantName ?? t("chat.agent"))
                            : item.role === "user"
                              ? t("chat.you")
                              : t("chat.system")
                        }
                        createdAt={item.createdAt}
                      />
                    </React.Fragment>
                  );
                }

                if (group.type === "divider") {
                  const { item } = group;
                  return (
                    <div key={item.key} className="px-4 py-2">
                      <Divider label={item.label} />
                    </div>
                  );
                }

                return (
                  <ToolCallTimeline
                    key={`timeline-${group.startIndex}`}
                    items={group.items}
                    thoughtComponent={GatedThoughtBlock}
                  />
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
              onClick={() => {
                // Hide the button immediately; the scroll listener keeps
                // `atBottom` accurate as the smooth scroll settles.
                setAtBottom(true);
                setUnread(0);
                scrollToBottom("smooth");
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Agent reasoning/thought block gated behind the `showThoughts` feature flag.
 */
const GatedThoughtBlock = withFeatureGate(ThoughtBlock, "showThoughts");
