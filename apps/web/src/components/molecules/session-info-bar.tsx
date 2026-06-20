import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionTag } from "@/components/domain";

export interface SessionInfoBarProps {
  /** Session title (editable). */
  title: string;
  /** Tags attached to the session. */
  tags?: SessionTag[];
  /** Agent-reported config chips to echo (e.g. model, thinking). */
  configChips?: { id: string; label: string; value: string }[];
  /** Save an edited title. */
  onRename?: (title: string) => void;
  /** Add / manage tags. */
  onManageTags?: () => void;
  className?: string;
}

const TAG_COLOR: Record<string, string> = {
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet:
    "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate:
    "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

/**
 * Session header bar with inline-editable title, tags, and config chips.
 *
 * @example
 * <SessionInfoBar title="Refactor parser" tags={tags} onRename={rename} />
 */
export function SessionInfoBar({
  title,
  tags = [],
  configChips = [],
  onRename,
  onManageTags,
  className,
}: SessionInfoBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(title);

  React.useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  const commit = React.useCallback(() => {
    const next = draft.trim();
    if (next && next !== title) onRename?.(next);
    else setDraft(title);
    setEditing(false);
  }, [draft, title, onRename]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border px-3 py-2",
        className,
      )}
    >
      {editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(title);
                setEditing(false);
              }
            }}
            className="h-7"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("session.saveTitle")}
            onClick={commit}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onRename && setEditing(true)}
          className="group flex min-w-0 items-center gap-1.5 text-left"
          title={t("session.rename")}
        >
          <span className="truncate text-sm font-semibold">{title}</span>
          {onRename ? (
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          ) : null}
        </button>
      )}

      {configChips.map((chip) => (
        <Badge
          key={chip.id}
          variant="secondary"
          className="gap-1 px-1.5 py-0 text-[10px] font-normal"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          {chip.value}
        </Badge>
      ))}

      <div className="ml-auto flex items-center gap-1">
        {tags.map((t) => (
          <span
            key={t.id}
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium",
              TAG_COLOR[t.color] ?? TAG_COLOR.slate,
            )}
          >
            {t.name}
          </span>
        ))}
        {onManageTags ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("session.manageTags")}
            onClick={onManageTags}
          >
            <Tag className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
