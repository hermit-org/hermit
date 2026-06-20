import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { McpServerEntry, McpConnectionState } from "@/components/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MCPConfigItemProps {
  /** The MCP server entry to render. */
  entry: McpServerEntry;
  /** Whether the server is enabled for new sessions. */
  enabled?: boolean;
  /** Toggle enabled state. */
  onToggleEnabled?: (enabled: boolean) => void;
  /** Test the connection (sets state to connecting then result). */
  onTest?: () => void;
  /** Edit the server configuration. */
  onEdit?: () => void;
  /** Delete the server configuration. */
  onDelete?: () => void;
  className?: string;
}

const STATE_META: Record<
  McpConnectionState,
  { label: string; variant: "success" | "secondary" | "warning" | "destructive"; dot: string }
> = {
  connected: { label: "connected", variant: "success", dot: "bg-success" },
  disconnected: { label: "disconnected", variant: "secondary", dot: "bg-muted-foreground" },
  connecting: { label: "connecting", variant: "warning", dot: "bg-warning animate-pulse" },
  error: { label: "error", variant: "destructive", dot: "bg-destructive" },
};

function transportLabel(entry: McpServerEntry): string {
  if ("type" in entry.config) return entry.config.type.toUpperCase();
  return "STDIO";
}

/**
 * MCP server config row: name, transport badge, connection status, enable
 * switch, test / edit / delete actions.
 *
 * @example
 * <MCPConfigItem entry={entry} enabled onTest={test} />
 */
export function MCPConfigItem({
  entry,
  enabled,
  onToggleEnabled,
  onTest,
  onEdit,
  onDelete,
  className,
}: MCPConfigItemProps): React.JSX.Element {
  const meta = STATE_META[entry.state];
  const busy = entry.state === "connecting";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {entry.config.name}
          </span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-mono">
            {transportLabel(entry)}
          </Badge>
          <Badge variant={meta.variant} className="gap-1 px-1.5 py-0 text-[10px]">
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </Badge>
        </div>
        {entry.lastError ? (
          <p className="mt-0.5 truncate text-xs text-destructive">
            {entry.lastError}
          </p>
        ) : null}
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {"command" in entry.config
            ? `${entry.config.command} ${(entry.config.args ?? []).join(" ")}`
            : entry.config.url}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={onTest}
      >
        <Plug className="h-3.5 w-3.5" />
        {busy ? "Testing" : "Test"}
      </Button>
      <Switch
        checked={enabled}
        onCheckedChange={onToggleEnabled}
        aria-label={`Enable ${entry.config.name}`}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Server actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDelete}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
