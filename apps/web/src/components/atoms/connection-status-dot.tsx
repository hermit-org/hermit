import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/components/domain";

export interface ConnectionStatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Current transport connection state. */
  status: ConnectionStatus;
  /** Show a pulsing ring while connecting/negotiating. */
  pulse?: boolean;
  /** Accessible label override; defaults to a human status name. */
  label?: string;
  /** Render size in pixels. */
  size?: number;
}

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  disconnected: "bg-muted-foreground",
  connecting: "bg-warning",
  negotiating: "bg-warning",
  connected: "bg-success",
  error: "bg-destructive",
};



/**
 * A small colored dot that reflects the ACP transport connection state.
 *
 * @example
 * <ConnectionStatusDot status="connected" />
 */
export const ConnectionStatusDot = React.forwardRef<
  HTMLSpanElement,
  ConnectionStatusDotProps
>(
  (
    { status, pulse = true, label: labelProp, size = 8, className, ...props },
    ref,
  ) => {
    const { t } = useTranslation();
    const label = labelProp ?? t(`connection.${status}`);
    const animated =
      pulse && (status === "connecting" || status === "negotiating");
    return (
      <span
        ref={ref}
        role="img"
        aria-label={label}
        className={cn(
          "relative inline-flex shrink-0 rounded-full",
          STATUS_COLOR[status],
          className,
        )}
        style={{ width: size, height: size }}
        {...props}
      >
        {animated && (
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-75",
              STATUS_COLOR[status],
              "animate-ping",
            )}
          />
        )}
      </span>
    );
  },
);
ConnectionStatusDot.displayName = "ConnectionStatusDot";
