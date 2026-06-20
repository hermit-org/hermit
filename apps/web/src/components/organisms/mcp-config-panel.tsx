import * as React from "react";
import { Plus, Server, PlugZap } from "lucide-react";
import { MCPConfigItem } from "@/components/molecules";
import { EmptyState } from "@/components/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { McpServerEntry, McpServerConfig } from "@/components/domain";

export type TransportKind = "stdio" | "http" | "sse";

export interface NewMcpServer {
  name: string;
  transport: TransportKind;
  command?: string;
  args?: string;
  url?: string;
}

export interface MCPConfigPanelProps {
  /** Configured MCP servers with connection state. */
  servers: McpServerEntry[];
  /** Enabled server names. */
  enabledNames?: Set<string>;
  /** Add a new server configuration. */
  onAdd?: (config: McpServerConfig) => void;
  /** Update an existing server configuration. */
  onUpdate?: (name: string, config: McpServerConfig) => void;
  /** Remove a server configuration. */
  onRemove?: (name: string) => void;
  /** Test the connection to a server. */
  onTest?: (name: string) => void;
  /** Toggle whether a server is enabled for new sessions. */
  onToggleEnabled?: (name: string, enabled: boolean) => void;
  className?: string;
}

/**
 * MCP server configuration panel: list of configured servers with connection
 * state, plus an "add server" dialog supporting stdio / http / sse transports
 * and a test-connection action.
 *
 * @example
 * <MCPConfigPanel servers={servers} onAdd={add} onTest={test} />
 */
export function MCPConfigPanel({
  servers,
  enabledNames,
  onAdd,
  onUpdate,
  onRemove,
  onTest,
  onToggleEnabled,
  className,
}: MCPConfigPanelProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<NewMcpServer>({
    name: "",
    transport: "stdio",
    command: "",
    args: "",
    url: "",
  });

  const resetForm = () =>
    setForm({
      name: "",
      transport: "stdio",
      command: "",
      args: "",
      url: "",
    });

  const submit = () => {
    if (!form.name.trim()) return;
    const config = buildConfig(form);
    if (!config) return;
    onAdd?.(config);
    resetForm();
    setOpen(false);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Server className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">MCP servers</span>
        <span className="text-xs text-muted-foreground">
          ({servers.length})
        </span>
        {onAdd ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto h-7"
              >
                <Plus className="h-3.5 w-3.5" />
                Add server
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add MCP server</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mcp-name">Name</Label>
                  <Input
                    id="mcp-name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="my-server"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mcp-transport">Transport</Label>
                  <Select
                    value={form.transport}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, transport: v as TransportKind }))
                    }
                  >
                    <SelectTrigger id="mcp-transport">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stdio">stdio</SelectItem>
                      <SelectItem value="http">http</SelectItem>
                      <SelectItem value="sse">sse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.transport === "stdio" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="mcp-command">Command</Label>
                      <Input
                        id="mcp-command"
                        value={form.command}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, command: e.target.value }))
                        }
                        placeholder="npx"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mcp-args">
                        Arguments (space-separated)
                      </Label>
                      <Input
                        id="mcp-args"
                        value={form.args}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, args: e.target.value }))
                        }
                        placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="mcp-url">URL</Label>
                    <Input
                      id="mcp-url"
                      value={form.url}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, url: e.target.value }))
                      }
                      placeholder="https://example.com/mcp"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={submit} disabled={!form.name.trim()}>
                  <PlugZap className="h-4 w-4" />
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {servers.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No MCP servers"
              description="Add an MCP server to extend the agent's tools."
              compact
            />
          ) : (
            servers.map((entry) => (
              <MCPConfigItem
                key={entry.config.name}
                entry={entry}
                enabled={enabledNames?.has(entry.config.name) ?? true}
                onToggleEnabled={(en) =>
                  onToggleEnabled?.(entry.config.name, en)
                }
                onTest={() => onTest?.(entry.config.name)}
                onEdit={() =>
                  onUpdate?.(entry.config.name, entry.config)
                }
                onDelete={() => onRemove?.(entry.config.name)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function buildConfig(form: NewMcpServer): McpServerConfig | null {
  const name = form.name.trim();
  if (!name) return null;
  if (form.transport === "stdio") {
    if (!form.command?.trim()) return null;
    return {
      name,
      command: form.command.trim(),
      args: form.args?.trim()
        ? form.args.trim().split(/\s+/)
        : undefined,
    };
  }
  if (!form.url?.trim()) return null;
  return {
    type: form.transport,
    name,
    url: form.url.trim(),
  };
}
