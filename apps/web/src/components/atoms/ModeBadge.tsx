import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/** Built-in ACP-style operating modes and their accent colors. */
export const MODE_META: Record<
  string,
  { label: string; variant: BadgeProps["variant"]; dot: string }
> = {
  ask: { label: "Ask", variant: "secondary", dot: "bg-blue-500" },
  architect: {
    label: "Architect",
    variant: "secondary",
    dot: "bg-violet-500",
  },
  code: { label: "Code", variant: "secondary", dot: "bg-emerald-500" },
  default: { label: "Mode", variant: "secondary", dot: "bg-muted-foreground" },
};

export interface ModeBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Operating mode id (e.g. "ask", "architect", "code"). */
  modeId: string;
  /** Optional human label override; otherwise derived from MODE_META. */
  label?: string;
}

/**
 * Color-coded badge for the current ACP session operating mode.
 *
 * @example
 * <ModeBadge modeId="code" />
 */
export function ModeBadge({
  modeId,
  label,
  className,
  ...props
}: ModeBadgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const meta = MODE_META[modeId] ?? MODE_META.default;
  return (
    <Badge
      variant={meta.variant}
      className={cn("gap-1.5 font-medium", className)}
      {...props}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {label ?? t(`mode.${modeId}`, { defaultValue: meta.label })}
    </Badge>
  );
}
