import * as React from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Slash } from "lucide-react";
import type { AvailableCommand } from "@hermit-org/acp";
import { SendButton, StopButton } from "@/components/atoms";
import { SlashCommandMenu } from "./slash-command-menu";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  /** Disable submit (e.g. not connected). */
  disabled?: boolean;
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
  disabled,
  maxRows = 8,
  className,
}: MessageComposerProps): React.JSX.Element {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t("composer.placeholder");
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const [highlight, setHighlight] = React.useState(0);

  const slash = React.useMemo(() => {
    const m = value.match(/(?:^|\s)\/([\w-]*)$/);
    if (!m) return null;
    return { query: m[1], start: (m.index ?? 0) + m[0].length - m[1].length };
  }, [value]);

  const showMenu = slash !== null && commands.length > 0;
  const slashQuery = slash?.query ?? "";

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
    if (!text || busy || disabled) return;
    onSubmit(text);
    onChange("");
  }, [value, busy, disabled, onSubmit, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => h + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // dismiss menu by trimming trailing slash query
        if (slash) onChange(value.slice(0, slash.start));
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleCommand = (cmd: AvailableCommand) => {
    if (slash) {
      const before = value.slice(0, slash.start);
      onChange(`${before}/${cmd.name} `);
    }
    onCommand?.(cmd);
    taRef.current?.focus();
  };

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
        className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring"
      >
        {onAttach ? (
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
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="max-h-[220px] min-h-[40px] flex-1 resize-none border-0 bg-transparent p-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {showMenu ? (
          <span className="mb-1 hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
            <Slash className="h-3 w-3" />
            ↑↓ {t("composer.navigateHint")}
          </span>
        ) : null}
        {busy ? (
          <StopButton onClick={onCancel} />
        ) : (
          <SendButton disabled={!value.trim() || disabled} />
        )}
      </form>
    </div>
  );
}
