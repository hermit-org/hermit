import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn, formatRelativeTime } from "@/lib/utils";

export interface TimestampProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Unix epoch (ms), ISO string, or Date. */
  value: number | string | Date;
  /** Render a relative ("5m ago") or absolute time. Defaults to "relative". */
  variant?: "relative" | "absolute" | "datetime";
  /** Custom absolute formatter options. */
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
}

/**
 * Accessible timestamp rendered as a relative or absolute string.
 *
 * @example
 * <Timestamp value={message.createdAt} />
 */
export function Timestamp({
  value,
  variant = "relative",
  dateStyle,
  timeStyle = "short",
  className,
  ...props
}: TimestampProps): React.JSX.Element {
  const time =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? new Date(value).getTime()
        : value.getTime();
  const iso = new Date(time).toISOString();

  let text: string;
  if (variant === "relative") {
    text = formatRelativeTime(value);
  } else if (variant === "datetime") {
    text = new Date(time).toLocaleString(undefined, {
      dateStyle: dateStyle ?? "medium",
      timeStyle,
    });
  } else {
    text = new Date(time).toLocaleString(undefined, {
      dateStyle: dateStyle ?? "medium",
      timeStyle,
    });
  }

  return (
    <time
      dateTime={iso}
      title={new Date(time).toLocaleString()}
      className={cn("text-xs tabular-nums text-muted-foreground", className)}
      {...props}
    >
      {text}
    </time>
  );
}
