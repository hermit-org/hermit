import * as React from "react";
import {
  HelpCircle,
  Compass,
  Code2,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SessionIconProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Operating mode id; selects the icon. */
  modeId?: string;
  /** Render size in pixels. */
  size?: number;
}

const MODE_ICON: Record<string, LucideIcon> = {
  ask: HelpCircle,
  architect: Compass,
  code: Code2,
};

/**
 * A session icon derived from the current operating mode.
 *
 * @example
 * <SessionIcon modeId="code" />
 */
export function SessionIcon({
  modeId,
  size = 16,
  className,
  ...props
}: SessionIconProps): React.JSX.Element {
  const Icon = (modeId && MODE_ICON[modeId]) || MessageSquare;
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      aria-hidden
      {...props}
    >
      <Icon style={{ width: size, height: size }} />
    </span>
  );
}
