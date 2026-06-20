import * as React from "react";
import { Zap, Eraser, SlashSquare, Layers } from "lucide-react";
import type { AvailableCommand } from "@hermit/acp";
import { MessageComposer } from "@/components/molecules";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface MessageComposerPanelProps {
  /** Current draft text. */
  value: string;
  /** Update the draft. */
  onChange: (value: string) => void;
  /** Submit the prompt. */
  onSubmit: (value: string) => void;
  /** Cancel an in-flight turn. */
  onCancel?: () => void;
  /** Whether a turn is currently streaming. */
  busy?: boolean;
  /** Disable the composer (e.g. no active session). */
  disabled?: boolean;
  /** Available slash commands. */
  commands?: AvailableCommand[];
  /** Attach a file. */
  onAttach?: () => void;
  /** Insert a quick command (e.g. a slash command shortcut). */
  onQuickCommand?: (command: AvailableCommand) => void;
  /** Clear the draft. */
  onClear?: () => void;
  /** Number of prompts queued behind the in-flight turn. */
  queueDepth?: number;
  className?: string;
}

/**
 * Composer panel: the message composer plus a quick-actions toolbar (clear,
 * slash-command shortcuts) above the input.
 *
 * @example
 * <MessageComposerPanel value={draft} onChange={setDraft} onSubmit={send} busy={busy} onCancel={cancel} commands={cmds} />
 */
export function MessageComposerPanel({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  disabled,
  commands = [],
  onAttach,
  onQuickCommand,
  onClear,
  queueDepth,
  className,
}: MessageComposerPanelProps): React.JSX.Element {
  const shortcuts = commands.slice(0, 4);

  return (
    <div className={cn("border-t border-border bg-background px-3 py-2", className)}>
      {queueDepth && queueDepth > 0 ? (
        <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <Layers className="h-3 w-3" />
          <span>{queueDepth} queued</span>
        </div>
      ) : null}
      {shortcuts.length > 0 ? (
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Zap className="h-3 w-3" />
            Quick
          </span>
          {shortcuts.map((cmd) => (
            <Tooltip key={cmd.name}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={disabled || busy}
                  onClick={() => onQuickCommand?.(cmd)}
                >
                  <SlashSquare className="h-3 w-3" />
                  {cmd.name}
                </Button>
              </TooltipTrigger>
              {cmd.description ? (
                <TooltipContent>{cmd.description}</TooltipContent>
              ) : null}
            </Tooltip>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <MessageComposer
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            onCancel={onCancel}
            busy={busy}
            disabled={disabled}
            commands={commands}
            onCommand={onQuickCommand}
            onAttach={onAttach}
          />
        </div>
        {value && onClear ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear input"
                className="shrink-0 rounded-full"
                onClick={onClear}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear input</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
