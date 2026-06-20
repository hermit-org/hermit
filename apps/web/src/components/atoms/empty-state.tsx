import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional leading icon. */
  icon?: LucideIcon;
  /** Primary heading. */
  title: string;
  /** Supporting description. */
  description?: React.ReactNode;
  /** Optional action node (e.g. a Button). */
  action?: React.ReactNode;
  /** Compact vertical padding. */
  compact?: boolean;
}

/**
 * Centered placeholder shown when a list / panel has no content.
 *
 * @example
 * <EmptyState icon={MessageSquare} title="No messages yet" />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
  ...props
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-8" : "py-16",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
