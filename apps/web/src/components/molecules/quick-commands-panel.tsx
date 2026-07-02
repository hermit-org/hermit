import * as React from "react";
import { useTranslation } from "react-i18next";
import { Zap, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { QuickCommand } from "@/types";

export interface QuickCommandsPanelProps {
  /** Enabled user-defined quick commands. */
  commands: QuickCommand[];
  /** Whether double-clicking a chip should send the content immediately. */
  doubleClickSendEnabled?: boolean;
  /** Insert content into the composer. */
  onInsert: (content: string) => void;
  /** Send content immediately. */
  onSend: (content: string) => void;
  /** Whether the composer is disabled. */
  disabled?: boolean;
  className?: string;
}

/**
 * Horizontal panel of user-defined quick-command chips above the composer.
 *
 * - Click: insert the command content into the composer.
 * - Double-click: send immediately when `doubleClickSendEnabled` is true.
 */
export function QuickCommandsPanel({
  commands,
  doubleClickSendEnabled = false,
  onInsert,
  onSend,
  disabled,
  className,
}: QuickCommandsPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (commands.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Zap className="h-3 w-3" />
        {t("common.quick")}
      </span>
      {commands.map((cmd) => (
        <Tooltip key={cmd.id}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] select-none"
              disabled={disabled}
              onClick={() => onInsert(cmd.content)}
              onDoubleClick={() => {
                if (doubleClickSendEnabled) {
                  onSend(cmd.content);
                } else {
                  onInsert(cmd.content);
                }
              }}
            >
              <MousePointerClick className="h-3 w-3" />
              {cmd.title}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">{cmd.title}</p>
            <p className="text-muted-foreground truncate">{cmd.content}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {doubleClickSendEnabled
                ? t("quickCommands.doubleClickTooltipEnabled")
                : t("quickCommands.doubleClickTooltipDisabled")}
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
