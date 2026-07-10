import * as React from "react";
import { ToolCallRenderer, TimelineContext } from "@/components/tool-calls";
import { ThoughtBlock } from "@/components/molecules/ThoughtBlock";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/components/domain";

type TimelineItem =
  | { kind: "tool_call"; key: string; call: ToolCallState }
  | { kind: "thought"; key: string; content: string; streaming?: boolean };

export interface ToolCallTimelineProps {
  items: TimelineItem[];
  className?: string;
  thoughtComponent?: React.ComponentType<{
    content: string;
    streaming?: boolean;
  }>;
}

/**
 * Renders a sequence of related tool calls and thoughts as a single unified
 * timeline panel instead of separate cards.
 */
export function ToolCallTimeline({
  items,
  className,
  thoughtComponent: ThoughtComponent = ThoughtBlock,
}: ToolCallTimelineProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "my-1 w-full overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm px-4",
        className,
      )}
    >
      <TimelineContext.Provider value={true}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <div key={item.key} className="relative flex gap-3 py-2">
              {/* Timeline connector line */}
              <div className="relative flex shrink-0 flex-col items-center pt-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                {!isLast ? (
                  <div className="w-px flex-1 border-l border-dashed border-muted-foreground/30" />
                ) : null}
              </div>
              {/* Item content */}
              <div className="min-w-0 flex-1">
                {item.kind === "tool_call" ? (
                  <ToolCallRenderer call={item.call} />
                ) : item.kind === "thought" ? (
                  <ThoughtComponent
                    content={item.content}
                    streaming={item.streaming}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </TimelineContext.Provider>
    </div>
  );
}
