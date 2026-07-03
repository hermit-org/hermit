import * as React from "react";
import { DollarSign } from "lucide-react";
import { cn, formatCost } from "@/lib/utils";

export interface CostDisplayProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Monetary amount. */
  amount: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** Hide the leading icon. */
  hideIcon?: boolean;
}

/**
 * Formatted monetary cost display.
 *
 * @example
 * <CostDisplay amount={0.0123} currency="USD" />
 */
export function CostDisplay({
  amount,
  currency,
  hideIcon,
  className,
  ...props
}: CostDisplayProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground",
        className,
      )}
      title={`${amount} ${currency}`}
      {...props}
    >
      {!hideIcon && <DollarSign className="h-3.5 w-3.5" aria-hidden />}
      <span>{formatCost(amount, currency)}</span>
    </span>
  );
}
