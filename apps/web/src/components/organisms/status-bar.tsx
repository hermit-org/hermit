import * as React from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import {
  ConnectionStatusDot,
  ModeBadge,
} from "@/components/atoms";
import { UsageStats } from "@/components/molecules";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  ConnectionStatus,
  UsageStats as UsageStatsData,
} from "@/components/domain";

export interface StatusBarProps {
  /** Transport connection state. */
  status: ConnectionStatus;
  /** Current operating mode id. */
  modeId?: string;
  /** Latest token usage. */
  usage?: UsageStatsData;
  /** Optional context window size for the progress bar. */
  contextWindow?: number;
  /** Whether a turn is currently streaming. */
  busy?: boolean;
  /** Open settings. */
  onOpenSettings?: () => void;
  className?: string;
}

/**
 * Bottom status bar: connection status, mode, usage/cost, and a settings button.
 *
 * @example
 * <StatusBar status="connected" modeId="code" usage={usage} busy onOpenSettings={openSettings} />
 */
export function StatusBar({
  status,
  modeId,
  usage,
  contextWindow,
  busy,
  onOpenSettings,
  className,
}: StatusBarProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <footer
      className={cn(
        "flex h-7 shrink-0 items-center gap-2 border-t border-border bg-muted/40 px-2 text-xs",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <ConnectionStatusDot status={status} size={7} pulse={false} />
        <span className="text-muted-foreground">{t(`connection.${status}` as const)}</span>
      </div>
      {busy ? (
        <>
          <Separator orientation="vertical" className="h-3.5" />
          <span className="flex items-center gap-1 text-blue-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            {t("statusBar.generating")}
          </span>
        </>
      ) : null}
      {modeId ? (
        <>
          <Separator orientation="vertical" className="h-3.5" />
          <ModeBadge modeId={modeId} className="px-1.5 py-0 text-[10px]" />
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {usage ? (
          <UsageStats
            usage={usage}
            contextWindow={contextWindow}
            compact
          />
        ) : null}
        {onOpenSettings ? (
          <>
            <Separator orientation="vertical" className="h-3.5" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              aria-label={t("statusBar.settings")}
              title={t("statusBar.settings")}
              onClick={onOpenSettings}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : null}
      </div>
    </footer>
  );
}
