import * as React from "react";
import { useTranslation } from "react-i18next";
import { Zap, Eraser, SlashSquare, Layers } from "lucide-react";
import type { AvailableCommand } from "@hermit-org/acp";
import { MessageComposer } from "@/components/molecules";
import { QuickCommandsPanel } from "@/components/molecules/quick-commands-panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PendingAttachment } from "@/types";
import type { QuickCommand } from "@/types";
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
  /** Whether authentication is required before the user can type. */
  requireAuth?: boolean;
  /** Agent-reported auth methods shown on the auth prompt. */
  authMethods?: { id: string; name: string; description?: string }[];
  /** Trigger authentication for the given method. */
  onAuthenticate?: (methodId: string) => void;
  /** Available slash commands. */
  commands?: AvailableCommand[];
  /** Attach a file. */
  onAttach?: () => void;
  /** Images currently attached to the draft. */
  attachments?: PendingAttachment[];
  /** Add image files to the draft. */
  onAttachImages?: (files: File[]) => void;
  /** Remove a previously-attached image by id. */
  onRemoveAttachment?: (id: string) => void;
  /** Insert a quick command (e.g. a slash command shortcut). */
  onQuickCommand?: (command: AvailableCommand) => void;
  /** Clear the draft. */
  onClear?: () => void;
  /** Number of prompts queued behind the in-flight turn. */
  queueDepth?: number;
  /** User-defined quick commands shown above the composer. */
  quickCommands?: QuickCommand[];
  /** Whether double-clicking a quick command sends it immediately. */
  doubleClickSendEnabled?: boolean;
  /** Insert a quick command into the composer. */
  onQuickCommandInsert?: (content: string) => void;
  /** Send a quick command immediately. */
  onQuickCommandSend?: (content: string) => void;
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
  attachments,
  onAttachImages,
  onRemoveAttachment,
  onQuickCommand,
  onClear,
  queueDepth,
  requireAuth,
  authMethods,
  onAuthenticate,
  quickCommands = [],
  doubleClickSendEnabled,
  onQuickCommandInsert,
  onQuickCommandSend,
  className,
}: MessageComposerPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const shortcuts = commands.slice(0, 4);
  const enabledQuickCommands = quickCommands.filter((c) => c.enabled);

  return (
    <div className={cn("border-t border-border bg-background px-3 py-2", className)}>
      {queueDepth && queueDepth > 0 ? (
        <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <Layers className="h-3 w-3" />
          <span>{queueDepth} {t("common.queued")}</span>
        </div>
      ) : null}
      {enabledQuickCommands.length > 0 ? (
        <QuickCommandsPanel
          commands={enabledQuickCommands}
          doubleClickSendEnabled={doubleClickSendEnabled}
          onInsert={onQuickCommandInsert ?? (() => {})}
          onSend={onQuickCommandSend ?? (() => {})}
          disabled={disabled || busy}
          className="mb-1.5"
        />
      ) : null}
      {shortcuts.length > 0 ? (
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Zap className="h-3 w-3" />
            {t("common.quick")}
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
            requireAuth={requireAuth}
            authMethods={authMethods}
            onAuthenticate={onAuthenticate}
            commands={commands}
            onCommand={onQuickCommand}
            onAttach={onAttach}
            attachments={attachments}
            onAttachImages={onAttachImages}
            onRemoveAttachment={onRemoveAttachment}
          />
        </div>
        {value && onClear ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("composer.clearInput")}
                className="shrink-0 rounded-full"
                onClick={onClear}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("composer.clearInput")}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
