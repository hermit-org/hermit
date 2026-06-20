import * as React from "react";
import { useTranslation } from "react-i18next";
import { Coins } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export interface TokenCounterProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Number of tokens used. */
  used: number;
  /** Optional total/context window size for the progress affordance. */
  total?: number;
  /** Hide the leading icon. */
  hideIcon?: boolean;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return formatNumber(n);
}

/**
 * Compact token-usage counter with an optional total budget.
 *
 * @example
 * <TokenCounter used={1234} total={200000} />
 */
export function TokenCounter({
  used,
  total,
  hideIcon,
  className,
  ...props
}: TokenCounterProps): React.JSX.Element {
  const { t } = useTranslation();
  const ratio =
    total && total > 0 ? Math.min(1, used / total) : undefined;
  const tone =
    ratio === undefined
      ? "text-muted-foreground"
      : ratio > 0.9
        ? "text-destructive"
        : ratio > 0.7
          ? "text-warning"
          : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        tone,
        className,
      )}
      title={total ? `${formatNumber(used)} / ${formatNumber(total)} ${t("common.tokens")}` : `${formatNumber(used)} ${t("common.tokens")}`}
      {...props}
    >
      {!hideIcon && <Coins className="h-3.5 w-3.5" aria-hidden />}
      <span>{compact(used)}</span>
      {total !== undefined && (
        <span className="opacity-60">/ {compact(total)}</span>
      )}
    </span>
  );
}
