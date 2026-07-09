import * as React from "react";
import { useTranslation } from "react-i18next";
import { ToolStatusIcon } from "@/components/atoms";
import { cn } from "@/lib/utils";
import { useDebugMode } from "@/hooks/useDebugMode";
import type { ToolCallState } from "@/components/domain";
import { getKindMeta } from "./meta";
import { CollapseChevron, STATUS_TONE, RawBlock } from "./parts";
import { renderRaw } from "./helpers";

export interface ToolCallShellProps {
  /** Accumulated tool-call state. */
  call: ToolCallState;
  /** Default collapsed state (default true). */
  defaultCollapsed?: boolean;
  /** Controlled collapsed state. */
  collapsed?: boolean;
  /** Fired when collapsed changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Right-aligned summary content inside the header (before status). */
  summary?: React.ReactNode;
  /** Whether the body has content to reveal (controls collapse affordance). */
  hasBody?: boolean;
  /** Override the kind badge (defaults to the call's kind). */
  badge?: React.ReactNode;
  /** Header content injected right after the kind icon. */
  iconSlot?: React.ReactNode;
  /** Body content shown when expanded. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The shared collapsible card shell used by every specialized tool-call
 * component. Renders the kind icon, kind badge, title, an optional inline
 * `summary`, and the lifecycle status in the header; reveals `children` in a
 * bordered body when expanded.
 */
export function ToolCallShell({
  call,
  defaultCollapsed = true,
  collapsed,
  onCollapsedChange,
  summary,
  hasBody = true,
  badge,
  iconSlot,
  children,
  className,
}: ToolCallShellProps): React.JSX.Element {
  const { t } = useTranslation();
  const debug = useDebugMode();
  const [internal, setInternal] = React.useState(defaultCollapsed);
  const isControlled = collapsed !== undefined;
  const isCollapsed = isControlled ? collapsed : internal;

  const meta = getKindMeta(call.kind);
  const { Icon, tone } = meta;

  const rawInput = renderRaw(call.rawInput);
  const rawOutput = renderRaw(call.rawOutput);
  const effectiveHasBody = hasBody || (debug && (!!rawInput || !!rawOutput));

  const canToggle = effectiveHasBody;
  const toggle = React.useCallback(() => {
    if (!canToggle) return;
    if (isControlled) {
      onCollapsedChange?.(!collapsed);
    } else {
      setInternal((c) => {
        const next = !c;
        onCollapsedChange?.(next);
        return next;
      });
    }
  }, [canToggle, isControlled, collapsed, onCollapsedChange]);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div
        role={canToggle ? "button" : undefined}
        tabIndex={canToggle ? 0 : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (canToggle && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={canToggle ? !isCollapsed : undefined}
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          canToggle && "cursor-pointer hover:bg-accent/50",
        )}
      >
        {canToggle ? (
          <CollapseChevron open={!isCollapsed} />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {iconSlot ?? (
          <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden />
        )}
        {badge}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {call.title ?? call.toolCallId}
        </span>
        {summary}
        {call.status ? (
          <span className="flex items-center gap-1">
            <ToolStatusIcon status={call.status} size={13} />
            <span
              className={cn(
                "text-xs font-semibold capitalize",
                STATUS_TONE[call.status],
              )}
            >
              {t(`tool.status.${call.status}` as const)}
            </span>
          </span>
        ) : null}
      </div>

      {!isCollapsed && effectiveHasBody ? (
        <div className="space-y-2 border-t border-border px-3 py-2 text-sm">
          {children}
          {debug && rawInput ? (
            <RawBlock label={t("tool.input")} value={rawInput} />
          ) : null}
          {debug && rawOutput ? (
            <RawBlock label={t("tool.output")} value={rawOutput} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
