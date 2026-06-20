import * as React from "react";
import { TokenCounter, CostDisplay } from "@/components/atoms";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UsageStats as UsageStatsData } from "@/components/domain";

export interface UsageStatsProps {
  /** Usage data from `usage_update`. */
  usage: UsageStatsData;
  /** Optional context-window size for the progress bar. */
  contextWindow?: number;
  /** Compact (inline) or full layout. */
  compact?: boolean;
  className?: string;
}

/**
 * Token usage + cost summary with a progress bar toward the context window.
 *
 * @example
 * <UsageStats usage={{ used: 1234, size: 5000, cost: { amount: 0.01, currency: "USD" } }} />
 */
export function UsageStats({
  usage,
  contextWindow,
  compact,
  className,
}: UsageStatsProps): React.JSX.Element {
  const ratio =
    contextWindow && contextWindow > 0
      ? Math.min(1, usage.used / contextWindow)
      : undefined;

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        <TokenCounter used={usage.used} total={contextWindow} />
        {usage.cost ? (
          <CostDisplay amount={usage.cost.amount} currency={usage.cost.currency} />
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <TokenCounter used={usage.used} total={contextWindow} />
        {usage.cost ? (
          <CostDisplay amount={usage.cost.amount} currency={usage.cost.currency} />
        ) : null}
      </div>
      {ratio !== undefined ? (
        <Progress
          value={usage.used}
          max={contextWindow}
          aria-label="Context window usage"
          className={cn(
            "h-1.5",
            ratio > 0.9 && "[&>div]:bg-destructive",
            ratio > 0.7 && ratio <= 0.9 && "[&>div]:bg-warning",
          )}
        />
      ) : null}
    </div>
  );
}
