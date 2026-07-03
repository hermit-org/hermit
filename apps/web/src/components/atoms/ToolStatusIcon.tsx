import * as React from "react";
import {
  CircleDashed,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallStatus } from "@/components/domain";

export interface ToolStatusIconProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tool call lifecycle status. */
  status?: ToolCallStatus;
  /** Render size in pixels. */
  size?: number;
  /** Optional spinner override; running status spins by default. */
  spin?: boolean;
}

const STATUS_ICON: Record<
  ToolCallStatus,
  { Icon: LucideIcon; className: string }
> = {
  pending: { Icon: CircleDashed, className: "text-muted-foreground" },
  in_progress: { Icon: Loader2, className: "text-blue-500" },
  completed: { Icon: CheckCircle2, className: "text-success" },
  failed: { Icon: XCircle, className: "text-destructive" },
};

/**
 * Icon reflecting a tool call's lifecycle status, with a spinner for
 * in-progress calls.
 *
 * @example
 * <ToolStatusIcon status="in_progress" />
 */
export function ToolStatusIcon({
  status,
  size = 16,
  spin,
  className,
  ...props
}: ToolStatusIconProps): React.JSX.Element {
  if (!status) {
    return (
      <span
        className={cn("inline-flex", className)}
        aria-hidden
        {...props}
      >
        <Ban style={{ width: size, height: size }} className="text-muted-foreground" />
      </span>
    );
  }
  const { Icon, className: iconClass } = STATUS_ICON[status];
  const shouldSpin = spin ?? status === "in_progress";
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      role="img"
      aria-label={status}
      {...props}
    >
      <Icon
        style={{ width: size, height: size }}
        className={cn(iconClass, shouldSpin && "animate-spin")}
      />
    </span>
  );
}
