import * as React from "react";
import { useTranslation } from "react-i18next";
import { Wrench, Filter } from "lucide-react";
import { ToolCallRenderer } from "@/components/tool-calls";
import { EmptyState } from "@/components/atoms";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ToolCallState, ToolCallStatus } from "@/components/domain";

export interface ToolCallPanelProps {
  /** All tool calls for the active session. */
  calls: ToolCallState[];
  /** Filter by status; undefined shows all. */
  statusFilter?: ToolCallStatus | "all";
  className?: string;
}

const STATUS_ORDER: ToolCallStatus[] = [
  "in_progress",
  "pending",
  "completed",
  "failed",
];

/**
 * Side panel listing all tool calls for the session, with status summary
 * chips and a status filter.
 *
 * @example
 * <ToolCallPanel calls={calls} />
 */
export function ToolCallPanel({
  calls,
  statusFilter,
  className,
}: ToolCallPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const [filter, setFilter] = React.useState<ToolCallStatus | "all">(
    statusFilter ?? "all",
  );

  const counts = React.useMemo(() => {
    const c: Record<ToolCallStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    };
    for (const call of calls) {
      const s = call.status ?? "pending";
      c[s] += 1;
    }
    return c;
  }, [calls]);

  const visible = React.useMemo(() => {
    const sorted = [...calls].sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.status ?? "pending");
      const bi = STATUS_ORDER.indexOf(b.status ?? "pending");
      return ai - bi;
    });
    if (filter === "all") return sorted;
    return sorted.filter((c) => (c.status ?? "pending") === filter);
  }, [calls, filter]);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{t("tool.title")}</span>
        <span className="text-xs text-muted-foreground">({calls.length})</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <Filter className="mr-1 h-3 w-3 text-muted-foreground" />
        <FilterChip
          label={t("tool.all")}
          active={filter === "all"}
          count={calls.length}
          onClick={() => setFilter("all")}
        />
        {STATUS_ORDER.map((s) => (
          <FilterChip
            key={s}
            label={t(`tool.status.${s}` as const)}
            tone={statusTone(s)}
            active={filter === s}
            count={counts[s]}
            disabled={counts[s] === 0}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {visible.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={t("tool.noCallsTitle")}
              description={t("tool.noCallsDescription")}
              compact
            />
          ) : (
            visible.map((call) => (
              <ToolCallRenderer
                key={call.toolCallId}
                call={call}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  tone?: "default" | "secondary" | "success" | "warning" | "destructive";
  onClick: () => void;
}): React.JSX.Element {
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium opacity-40">
        {label}
        <span className="tabular-nums">{count}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-accent text-accent-foreground hover:bg-accent/70",
      )}
    >
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function statusTone(
  s: ToolCallStatus,
): "default" | "secondary" | "success" | "warning" | "destructive" {
  switch (s) {
    case "in_progress":
      return "warning";
    case "completed":
      return "success";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}
