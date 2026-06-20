import * as React from "react";
import {
  MoreHorizontal,
  Trash2,
  Copy as CopyIcon,
  GitFork,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { SessionIcon, ModeBadge, Timestamp } from "@/components/atoms";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionTag } from "@/components/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SessionListItemProps {
  /** Session id. */
  id: string;
  /** Display title. */
  title: string;
  /** Last-updated timestamp. */
  updatedAt: number | string | Date;
  /** Operating mode id (optional). */
  modeId?: string;
  /** Tags for color coding / filtering. */
  tags?: SessionTag[];
  /** Whether this item is the active selection. */
  active?: boolean;
  /** Whether the agent-side session has been closed. */
  closed?: boolean;
  /** Whether the session is being resumed/loaded. */
  loading?: boolean;
  /** Capabilities controlling which menu actions are available. */
  canFork?: boolean;
  canResume?: boolean;
  canClose?: boolean;
  /** Select this session. */
  onSelect?: (id: string) => void;
  /** Request a fork of this session. */
  onFork?: (id: string) => void;
  /** Duplicate the session locally. */
  onDuplicate?: (id: string) => void;
  /** Delete the session. */
  onDelete?: (id: string) => void;
  /** Close the agent-side session. */
  onClose?: (id: string) => void;
  /** Resume / load the session history. */
  onResume?: (id: string) => void;
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
 * Sidebar list item for a session with mode badge, tags, and a kebab menu of
 * lifecycle actions (fork / duplicate / close / resume / delete).
 *
 * @example
 * <SessionListItem id="s1" title="Refactor" updatedAt={Date.now()} modeId="code" active onSelect={open} />
 */
export function SessionListItem({
  id,
  title,
  updatedAt,
  modeId,
  tags = [],
  active,
  closed,
  loading,
  canFork,
  canResume,
  canClose,
  onSelect,
  onFork,
  onDuplicate,
  onDelete,
  onClose,
  onResume,
  className,
}: SessionListItemProps): React.JSX.Element {
  const handleSelect = React.useCallback(() => {
    onSelect?.(id);
  }, [id, onSelect]);

  return (
    <div
      role="button"
      tabIndex={0}
      data-active={active ? "" : undefined}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent",
        className,
      )}
    >
      <span className="shrink-0 text-muted-foreground">
        <SessionIcon modeId={modeId} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate font-medium",
              closed && "text-muted-foreground line-through",
            )}
          >
            {title}
          </span>
          {loading ? (
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <Timestamp value={updatedAt} className="text-[11px]" />
          {modeId ? (
            <ModeBadge modeId={modeId} className="scale-90 px-1.5 py-0 text-[10px]" />
          ) : null}
          {closed ? (
            <Badge variant="outline" className="scale-90 px-1.5 py-0 text-[10px] text-muted-foreground">
              closed
            </Badge>
          ) : null}
        </div>
        {tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
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
          </div>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Session actions"
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {canResume ? (
            <DropdownMenuItem onClick={() => onResume?.(id)}>
              <RotateCcw />
              Resume / load
            </DropdownMenuItem>
          ) : null}
          {canFork ? (
            <DropdownMenuItem onClick={() => onFork?.(id)}>
              <GitFork />
              Fork
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => onDuplicate?.(id)}>
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
          {canClose && !closed ? (
            <DropdownMenuItem onClick={() => onClose?.(id)}>
              <XCircle />
              Close
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete?.(id)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
