import * as React from "react";
import { useTranslation } from "react-i18next";
import { LogIn, Paperclip, Slash, X, ImageIcon } from "lucide-react";
import type { AvailableCommand } from "@hermit-org/acp";
import { SendButton, StopButton } from "@/components/atoms";
import type { PendingAttachment } from "@/types";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Maximum number of images a single prompt may carry. */
export const MAX_IMAGES = 4;

/** Extract image files from a clipboard DataTransfer object.
 * Prefers `files` (copied image files have real names there) and falls back
 * to `items` for screenshots that some browsers only expose via items. */
function extractImageFiles(dataTransfer: DataTransfer): File[] {
  const files = Array.from(dataTransfer.files).filter((f) =>
    f.type.startsWith("image/"),
  );
  if (files.length > 0) return files;

  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null);
}

export interface MessageComposerProps {
  /** Current draft text. */
  value: string;
  /** Update the draft. */
  onChange: (value: string) => void;
  /** Submit the prompt. */
  onSubmit: (value: string) => void;
  /** Cancel an in-flight turn. */
  onCancel?: () => void;
  /** Whether a turn is currently streaming (shows Stop button). */
  busy?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** Available slash commands for the popup. */
  commands?: AvailableCommand[];
  /** Pick a slash command. */
  onCommand?: (command: AvailableCommand) => void;
  /** Attach a file (image / context). */
  onAttach?: () => void;
  /** Images currently attached to the draft. */
  attachments?: PendingAttachment[];
  /** Add image files to the draft (the parent owns the max-count check). */
  onAttachImages?: (files: File[]) => void;
  /** Remove a previously-attached image by id. */
  onRemoveAttachment?: (id: string) => void;
  /** Disable submit (e.g. not connected). */
  disabled?: boolean;
  /** Whether authentication is required before the user can type. */
  requireAuth?: boolean;
  /** Agent-reported auth methods shown on the auth prompt. */
  authMethods?: { id: string; name: string; description?: string }[];
  /** Trigger authentication for the given method. */
  onAuthenticate?: (methodId: string) => void;
  /** Auto-grow the textarea up to this max height (px). */
  maxRows?: number;
  className?: string;
}

/**
 * Message composer: textarea with auto-grow, slash-command popup, attach
 * button, and Send / Stop actions. Enter submits, Shift+Enter inserts a
 * newline.
 *
 * @example
 * <MessageComposer value={draft} onChange={setDraft} onSubmit={send} busy={busy} onCancel={cancel} />
 */
export function MessageComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  placeholder: placeholderProp,
  commands = [],
  onCommand,
  onAttach,
  attachments = [],
  onAttachImages,
  onRemoveAttachment,
  disabled,
  requireAuth,
  authMethods = [],
  onAuthenticate,
  maxRows = 8,
  className,
}: MessageComposerProps): React.JSX.Element {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t("composer.placeholder");
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [highlight, setHighlight] = React.useState(0);

  const canAttach = !!onAttachImages && attachments.length < MAX_IMAGES;
  const openFilePicker = React.useCallback(() => {
    if (canAttach) fileRef.current?.click();
  }, [canAttach]);

  const handleFilesPicked = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) onAttachImages?.(files);
      // Reset so picking the same file again re-triggers onChange.
      e.target.value = "";
    },
    [onAttachImages],
  );

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!canAttach) return;
      const files = extractImageFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      onAttachImages?.(files);
    },
    [canAttach, onAttachImages],
  );

  const slash = React.useMemo(() => {
    const m = value.match(/(?:^|\s)\/([\w-]*)$/);
    if (!m) return null;
    return { query: m[1], start: (m.index ?? 0) + m[0].length - m[1].length };
  }, [value]);

  const showMenu = slash !== null && commands.length > 0;
  const slashQuery = slash?.query ?? "";

  // Mirror the SlashCommandMenu's filter so keyboard navigation can clamp to
  // the actual number of visible commands.
  const filteredCommands = React.useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const name = c.name.toLowerCase();
      const desc = (c.description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [commands, slashQuery]);
  const filteredCommandCount = filteredCommands.length;

  const autoGrow = React.useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const max = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [maxRows]);

  React.useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  const submit = React.useCallback(() => {
    const text = value.trim();
    // Allow an image-only send: submit when there is text OR attached images.
    if ((!text && attachments.length === 0) || busy || disabled) return;
    // If onSubmit returns a promise, await it and only clear the draft on
    // success so a failed submission can be retried.
    const maybe = onSubmit(text) as unknown;
    if (maybe && typeof (maybe as Promise<void>).then === "function") {
      void (maybe as Promise<void>).then(
        () => onChange(""),
        () => {
          /* leave draft intact for retry */
        },
      );
    } else {
      onChange("");
    }
  }, [value, attachments.length, busy, disabled, onSubmit, onChange]);

  const handleCommand = React.useCallback(
    (cmd: AvailableCommand) => {
      if (slash) {
        const before = value.slice(0, slash.start);
        onChange(`${before}/${cmd.name} `);
      }
      onCommand?.(cmd);
      taRef.current?.focus();
    },
    [slash, value, onChange, onCommand],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showMenu) {
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.nativeEvent.isComposing &&
          e.keyCode !== 229
        ) {
          e.preventDefault();
          const cmd = filteredCommands[Math.min(highlight, filteredCommands.length - 1)];
          if (cmd) handleCommand(cmd);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlight((h) => {
            const len = Math.max(1, filteredCommandCount);
            return (h + 1) % len;
          });
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlight((h) => {
            const len = Math.max(1, filteredCommandCount);
            return (h - 1 + len) % len;
          });
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          // dismiss menu by trimming trailing slash query
          if (slash) onChange(value.slice(0, slash.start));
          return;
        }
      }
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.nativeEvent.isComposing &&
        e.keyCode !== 229
      ) {
        e.preventDefault();
        submit();
      }
    },
    [
      showMenu,
      filteredCommands,
      filteredCommandCount,
      highlight,
      slash,
      value,
      onChange,
      submit,
      handleCommand,
    ],
  );

  return (
    <div className={cn("relative", className)}>
      {showMenu ? (
        <div className="absolute bottom-full left-0 z-20 mb-2">
          <SlashCommandMenu
            commands={commands}
            query={slashQuery}
            highlightedIndex={highlight}
            onHighlightedIndexChange={setHighlight}
            onSelect={handleCommand}
          />
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring"
      >
        {attachments.length > 0 ? (
          <AttachmentStrip
            attachments={attachments}
            onRemove={onRemoveAttachment}
          />
        ) : null}
        <div className="flex items-end gap-2">
          {onAttachImages ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesPicked}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("composer.attachImage")}
                title={t("composer.maxImages", { count: MAX_IMAGES })}
                disabled={!canAttach}
                className="shrink-0 rounded-full"
                onClick={openFilePicker}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </>
          ) : onAttach ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("composer.attachFile")}
              className="shrink-0 rounded-full"
              onClick={onAttach}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="relative flex-1">
            <Textarea
              ref={taRef}
              data-testid="composer-textarea"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={1}
              disabled={disabled || requireAuth}
              className="max-h-[220px] min-h-[40px] w-full resize-none border-0 bg-transparent p-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {requireAuth ? (
              <AuthOverlay
                authMethods={authMethods}
                onAuthenticate={onAuthenticate}
              />
            ) : null}
          </div>
          {showMenu ? (
            <span className="mb-1 hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
              <Slash className="h-3 w-3" />
              ↑↓ {t("composer.navigateHint")}
            </span>
          ) : null}
          {busy ? (
            <StopButton onClick={onCancel} />
          ) : (
            <SendButton
              data-testid="composer-send-button"
              disabled={
                (!value.trim() && attachments.length === 0) ||
                disabled ||
                requireAuth
              }
            />
          )}
        </div>
      </form>
    </div>
  );
}

function AuthOverlay({
  authMethods,
  onAuthenticate,
}: {
  authMethods: { id: string; name: string; description?: string }[];
  onAuthenticate?: (methodId: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const method = authMethods[0];

  return (
    <div className="absolute inset-0 flex items-center justify-between gap-2 rounded-2xl bg-card/95 px-3 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 text-sm">
          <LogIn className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium text-foreground">
            {t("composer.authRequired")}
          </span>
          {method ? (
            <span className="truncate text-muted-foreground">
              {method.description ?? method.name}
            </span>
          ) : null}
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {t("composer.authHint")}
        </span>
      </div>
      {method ? (
        <Button
          type="button"
          size="sm"
          onClick={() => onAuthenticate?.(method.id)}
          className="shrink-0"
        >
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          {method.name}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Thumbnail strip of pending image attachments shown inside the composer.
 * Each thumbnail has a remove (×) button. Releasing object URLs is the
 * parent's responsibility (it owns the attachment lifecycle).
 */
function AttachmentStrip({
  attachments,
  onRemove,
}: {
  attachments: PendingAttachment[];
  onRemove?: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="group/att relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
        >
          <img
            src={att.previewUrl}
            alt={att.name}
            className="h-full w-full object-cover"
          />
          {onRemove ? (
            <button
              type="button"
              aria-label={t("composer.removeImage")}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity hover:bg-background group-hover/att:opacity-100"
              onClick={() => onRemove(att.id)}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
