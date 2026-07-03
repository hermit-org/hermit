import * as React from "react";
import { Separator } from "@/components/ui/Separator";
import { cn } from "@/lib/utils";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional orientation. */
  orientation?: "horizontal" | "vertical";
  /** Optional centered text label rendered on top of the line. */
  label?: React.ReactNode;
}

/**
 * Separator line with an optional centered label (e.g. "Today").
 *
 * @example
 * <Divider label="Today" />
 */
export function Divider({
  orientation = "horizontal",
  label,
  className,
  ...props
}: DividerProps): React.JSX.Element {
  if (!label) {
    return (
      <Separator
        orientation={orientation}
        className={cn(className)}
        {...props}
      />
    );
  }
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "flex items-center gap-3 text-xs text-muted-foreground",
        orientation === "vertical" && "flex-col",
        className,
      )}
      {...props}
    >
      <Separator className="flex-1" orientation={orientation} />
      <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      <Separator className="flex-1" orientation={orientation} />
    </div>
  );
}
