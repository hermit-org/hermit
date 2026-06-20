import * as React from "react";
import { Settings, PanelRightOpen, TerminalSquare } from "lucide-react";
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
  /** Optional context window size. */
  contextWindow?: number;
  /** Whether a turn is currently streaming. */
  busy?: boolean;
  /** Toggle the right panel (tools/files). */
  onToggleRightPanel?: () => void;
  /** Toggle the terminal panel. */
  onToggleTerminal?: () => void;
  /** Open settings. */
  onOpenSettings?: () => void;
  className?: string;
}

/**
 * Bottom status bar: connection status, mode, usage/cost, and quick toggles
 * for the side panels.
 *
 * @example
 * <StatusBar status="connected" modeId="code" usage={usage} busy onToggleTerminal={toggle} />
 */
export function StatusBar({
  status,
  modeId,
  usage,
  contextWindow,
  busy,
  onToggleRightPanel,
  onToggleTerminal,
  onOpenSettings,
  className,
}: StatusBarProps): React.JSX.Element {
  return (
    <footer
      className={cn(
        "flex h-7 shrink-0 items-center gap-2 border-t border-border bg-muted/40 px-2 text-xs",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <ConnectionStatusDot status={status} size={7} pulse={false} />
        <span className="text-muted-foreground">{status}</span>
      </div>
      {busy ? (
        <>
          <Separator orientation="vertical" className="h-3.5" />
          <span className="flex items-center gap-1 text-blue-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            generating
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
        <Separator orientation="vertical" className="h-3.5" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          aria-label="Toggle terminal"
          title="Toggle terminal"
          onClick={onToggleTerminal}
        >
          <TerminalSquare className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          aria-label="Toggle panel"
          title="Toggle panel"
          onClick={onToggleRightPanel}
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          aria-label="Settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </footer>
  );
}
