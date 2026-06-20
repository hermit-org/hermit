import * as React from "react";
import { Plus, Search, MessageSquarePlus, Filter } from "lucide-react";
import { SessionListItem } from "@/components/molecules";
import { EmptyState } from "@/components/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SessionTag } from "@/components/domain";

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: number | string | Date;
  modeId?: string;
  tags?: SessionTag[];
  closed?: boolean;
  loading?: boolean;
}

export interface SessionSidebarProps {
  /** Sessions to render. */
  sessions: SessionSummary[];
  /** Active session id. */
  activeId?: string;
  /** All known tags (for the filter chips). */
  availableTags?: SessionTag[];
  /** Capabilities forwarded to each SessionListItem. */
  canFork?: boolean;
  canResume?: boolean;
  canClose?: boolean;
  /** Select a session. */
  onSelect?: (id: string) => void;
  /** Create a new session. */
  onCreate?: () => void;
  /** Session lifecycle actions forwarded to each item. */
  onFork?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClose?: (id: string) => void;
  onResume?: (id: string) => void;
  className?: string;
}

/**
 * Left sidebar: search + tag filter, new-session button, and the scrollable
 * session list.
 *
 * @example
 * <SessionSidebar sessions={sessions} activeId="s1" onSelect={open} onCreate={create} />
 */
export function SessionSidebar({
  sessions,
  activeId,
  availableTags = [],
  canFork,
  canResume,
  canClose,
  onSelect,
  onCreate,
  onFork,
  onDuplicate,
  onDelete,
  onClose,
  onResume,
  className,
}: SessionSidebarProps): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q)) return false;
      if (
        activeTag &&
        !(s.tags ?? []).some((t) => t.id === activeTag)
      ) {
        return false;
      }
      return true;
    });
  }, [sessions, query, activeTag]);

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-background",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="default"
          aria-label="New session"
          title="New session"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {availableTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              activeTag === null
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            All
          </button>
          {availableTags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                setActiveTag((cur) => (cur === t.id ? null : t.id))
              }
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                activeTag === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground hover:bg-accent/70",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      ) : null}

      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title={query || activeTag ? "No matching sessions" : "No sessions yet"}
              description={
                query || activeTag
                  ? "Try a different search or filter."
                  : "Create a session to start chatting."
              }
              compact
              action={
                !query && !activeTag && onCreate ? (
                  <Button size="sm" variant="outline" onClick={onCreate}>
                    <Plus className="h-4 w-4" />
                    New session
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-0.5">
              {filtered.map((s) => (
                <SessionListItem
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  updatedAt={s.updatedAt}
                  modeId={s.modeId}
                  tags={s.tags}
                  closed={s.closed}
                  loading={s.loading}
                  active={s.id === activeId}
                  canFork={canFork}
                  canResume={canResume}
                  canClose={canClose}
                  onSelect={onSelect}
                  onFork={onFork}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  onClose={onClose}
                  onResume={onResume}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
