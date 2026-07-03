import * as React from "react";
import { Badge as UiBadge, type BadgeProps } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export interface BadgeAtomProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    Pick<BadgeProps, "variant"> {
  /** Semantic color tone (maps to variant). */
  tone?: BadgeTone;
  /** Optional leading dot indicator. */
  dot?: boolean;
  /** Dot color class override. */
  dotClassName?: string;
}

/**
 * Semantic badge atom with optional colored dot indicator.
 *
 * @example
 * <BadgeAtom tone="success" dot>online</BadgeAtom>
 */
export function BadgeAtom({
  tone = "secondary",
  dot,
  dotClassName,
  className,
  children,
  ...props
}: BadgeAtomProps): React.JSX.Element {
  return (
    <UiBadge
      variant={tone}
      className={cn("gap-1.5", className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotClassName ?? "bg-current opacity-70",
          )}
        />
      ) : null}
      {children}
    </UiBadge>
  );
}
