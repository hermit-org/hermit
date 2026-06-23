import * as React from "react";
import { useTranslation } from "react-i18next";
import type { AgentCapabilities } from "@hermit-org/acp";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FEATURE_CATEGORY_ORDER,
  resolveAcpFeatures,
  summarizeFeatures,
  type FeatureStatus,
} from "@/lib/acp-features";

export interface ProtocolBadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** ACP protocol version string, e.g. "1". */
  version?: string;
  /** Agent capabilities advertised via `initialize`. Drives the detail panel. */
  agentCapabilities?: AgentCapabilities;
  /** Whether the `initialize` handshake has completed. */
  initialized?: boolean;
}

const STATUS_DOT_CLASS: Record<FeatureStatus, string> = {
  supported: "bg-success",
  partial: "bg-warning",
  unsupported: "bg-destructive",
};

/**
 * Displays the negotiated ACP protocol version as a compact badge.
 *
 * Hover (or focus) the badge to reveal a detailed panel listing every ACP v1
 * feature and its traffic-light support status, derived from the agent's
 * advertised capabilities.
 *
 * @example
 * <ProtocolBadge version="1" agentCapabilities={caps} initialized />
 */
export function ProtocolBadge({
  version = "1",
  agentCapabilities,
  initialized = false,
  className,
  ...props
}: ProtocolBadgeProps): React.JSX.Element {
  const { t } = useTranslation();

  const items = React.useMemo(
    () => resolveAcpFeatures(agentCapabilities, initialized),
    [agentCapabilities, initialized],
  );
  const summary = React.useMemo(() => summarizeFeatures(items), [items]);

  // Overall indicator colour mirrors the worst non-green state, falling back
  // to green when everything is supported.
  const overall: FeatureStatus =
    summary.unsupported > 0
      ? "unsupported"
      : summary.partial > 0
        ? "partial"
        : "supported";

  return (
    <TooltipProvider delayDuration={300} disableHoverableContent={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            role="button"
            tabIndex={0}
            className={cn(
              "gap-1 cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
            {...props}
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                STATUS_DOT_CLASS[overall],
              )}
            />
            {t("connection.protocolBadge", { version })}
          </Badge>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-80 max-w-[calc(100vw-2rem)] bg-popover p-0 text-popover-foreground shadow-lg"
        >
          <ProtocolFeaturePanel
            items={items}
            summary={summary}
            version={version}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Hover panel body rendered inside the tooltip portal. */
function ProtocolFeaturePanel({
  items,
  summary,
  version,
}: {
  items: ReturnType<typeof resolveAcpFeatures>;
  summary: ReturnType<typeof summarizeFeatures>;
  version: string;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold">
          {t("connection.protocolPanel.title", { version })}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <SummaryPill status="supported" count={summary.supported} />
          <SummaryPill status="partial" count={summary.partial} />
          {summary.unsupported > 0 ? (
            <SummaryPill status="unsupported" count={summary.unsupported} />
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="max-h-72 overflow-y-auto px-3 py-2">
        {FEATURE_CATEGORY_ORDER.map((category) => {
          const groupItems = items.filter((i) => i.category === category);
          if (groupItems.length === 0) return null;
          return (
            <section key={category} className="mb-2 last:mb-0">
              <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t(`connection.protocolPanel.categories.${category}`)}
              </h4>
              <ul className="space-y-0.5">
                {groupItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        STATUS_DOT_CLASS[item.status],
                      )}
                    />
                    <span className="font-mono text-[11px] text-foreground/90">
                      {item.spec}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {t(`connection.protocolPanel.status.${item.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        <LegendItem status="supported" />
        <LegendItem status="partial" />
        <LegendItem status="unsupported" />
      </div>
    </div>
  );
}

function SummaryPill({
  status,
  count,
}: {
  status: FeatureStatus;
  count: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT_CLASS[status])}
      />
      {count}
      <span className="sr-only">
        {t(`connection.protocolPanel.status.${status}`)}
      </span>
    </span>
  );
}

function LegendItem({ status }: { status: FeatureStatus }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT_CLASS[status])}
      />
      {t(`connection.protocolPanel.status.${status}`)}
    </span>
  );
}
