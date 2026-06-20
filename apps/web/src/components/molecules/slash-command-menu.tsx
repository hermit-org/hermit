import * as React from "react";
import { useTranslation } from "react-i18next";
import { CornerDownLeft, Search } from "lucide-react";
import type { AvailableCommand } from "@hermit/acp";
import { cn } from "@/lib/utils";

export interface SlashCommandMenuProps {
  /** Available slash commands (from `available_commands_update`). */
  commands: AvailableCommand[];
  /** Current filter query (the text after `/`). */
  query?: string;
  /** Index of the highlighted command (-1 = none). */
  highlightedIndex?: number;
  /** Pick a command. */
  onSelect: (command: AvailableCommand) => void;
  /** Change the highlighted index (keyboard navigation). */
  onHighlightedIndexChange?: (index: number) => void;
  className?: string;
}

/**
 * Floating slash-command completion menu with fuzzy filtering and keyboard
 * navigation.
 *
 * @example
 * <SlashCommandMenu commands={cmds} query="hel" onSelect={pick} />
 */
export function SlashCommandMenu({
  commands,
  query = "",
  highlightedIndex = 0,
  onSelect,
  onHighlightedIndexChange,
  className,
}: SlashCommandMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const name = c.name.toLowerCase();
      const desc = (c.description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [commands, query]);

  const safeHighlight = Math.min(
    Math.max(0, highlightedIndex),
    Math.max(0, filtered.length - 1),
  );

  if (filtered.length === 0) {
    return (
      <div
        className={cn(
          "w-72 rounded-lg border border-border bg-popover p-3 text-xs text-muted-foreground shadow-md",
          className,
        )}
      >
        {t("composer.noCommands")}
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label={t("composer.slashCommands")}
      className={cn(
        "flex max-h-64 w-72 flex-col overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Search className="h-3 w-3" />
        {t("common.commands")}
      </div>
      <div className="max-h-56 overflow-auto">
        {filtered.map((cmd, i) => {
          const active = i === safeHighlight;
          return (
            <button
              key={cmd.name}
              type="button"
              role="option"
              aria-selected={active}
              onMouseEnter={() => onHighlightedIndexChange?.(i)}
              onClick={() => onSelect(cmd)}
              className={cn(
                "flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-sm",
                active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs font-medium">
                  /{cmd.name}
                </span>
                {cmd.description ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {cmd.description}
                  </span>
                ) : null}
              </span>
              {active ? (
                <CornerDownLeft className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
