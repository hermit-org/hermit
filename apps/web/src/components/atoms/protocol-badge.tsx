import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ProtocolBadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** ACP protocol version string, e.g. "1". */
  version?: string;
}

/**
 * Displays the negotiated ACP protocol version as a compact badge.
 *
 * @example
 * <ProtocolBadge version="1" />
 */
export function ProtocolBadge({
  version = "1",
  className,
  ...props
}: ProtocolBadgeProps): React.JSX.Element {
  return (
    <Badge variant="secondary" className={cn("gap-1", className)} {...props}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
      ACP v{version}
    </Badge>
  );
}
