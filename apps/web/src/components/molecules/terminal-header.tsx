import * as React from "react";
import { useTranslation } from "react-i18next";
import { TerminalSquare, X, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TerminalHeaderProps {
  /** Terminal title / command. */
  title: string;
  /** Working directory (optional). */
  cwd?: string;
  /** Whether the process is still running. */
  running?: boolean;
  /** Exit status once finished. */
  exitStatus?: number | null;
  /** Kill the running process. */
  onKill?: () => void;
  /** Close the terminal panel. */
  onClose?: () => void;
  className?: string;
}

/**
 * Header for a terminal panel: title, process status badge, kill & close
 * actions.
 *
 * @example
 * <TerminalHeader title="npm run dev" running onKill={kill} onClose={close} />
 */
export function TerminalHeader({
  title,
  cwd,
  running,
  exitStatus,
  onKill,
  onClose,
  className,
}: TerminalHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5",
        className,
      )}
    >
      <TerminalSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-xs font-medium">
            {title}
          </span>
          {running ? (
            <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              {t("terminal.running")}
            </Badge>
          ) : exitStatus !== undefined && exitStatus !== null ? (
            <Badge
              variant={exitStatus === 0 ? "success" : "destructive"}
              className="px-1.5 py-0 text-[10px]"
            >
              {t("terminal.exit")} {exitStatus}
            </Badge>
          ) : (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
              {t("terminal.idle")}
            </Badge>
          )}
        </div>
        {cwd ? (
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {cwd}
          </div>
        ) : null}
      </div>
      {running ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("terminal.killProcess")}
          title={t("terminal.killProcess")}
          onClick={onKill}
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("terminal.closeTerminal")}
        title={t("terminal.closeTerminal")}
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
