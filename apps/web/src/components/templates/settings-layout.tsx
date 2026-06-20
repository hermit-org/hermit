import * as React from "react";
import { Server, Palette, Keyboard, ArrowLeft } from "lucide-react";
import { MCPConfigPanel } from "@/components/organisms/mcp-config-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MOCK_MCP_SERVERS } from "./mock-data";
import type { McpServerConfig, McpServerEntry } from "@/components/domain";

export interface SettingsLayoutProps {
  /** Initial active section. */
  defaultSection?: SettingsSection;
  /** Go back to the previous view. */
  onBack?: () => void;
  /** MCP servers (defaults to mock data). */
  servers?: McpServerEntry[];
  /** Enabled MCP server names. */
  enabledNames?: Set<string>;
  /** MCP server lifecycle handlers. */
  onAddServer?: (config: McpServerConfig) => void;
  onUpdateServer?: (name: string, config: McpServerConfig) => void;
  onRemoveServer?: (name: string) => void;
  onTestServer?: (name: string) => void;
  onToggleServer?: (name: string, enabled: boolean) => void;
  className?: string;
}

export type SettingsSection = "mcp" | "appearance" | "shortcuts";

const SECTIONS: { id: SettingsSection; label: string; icon: typeof Server }[] =
  [
    { id: "mcp", label: "MCP servers", icon: Server },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  ];

/**
 * Settings page layout template: a left navigation of sections and a content
 * pane that swaps between MCP config, appearance, and shortcuts.
 *
 * @example
 * <SettingsLayout onBack={goBack} />
 */
export function SettingsLayout({
  defaultSection = "mcp",
  onBack,
  servers = MOCK_MCP_SERVERS,
  enabledNames,
  onAddServer,
  onUpdateServer,
  onRemoveServer,
  onTestServer,
  onToggleServer,
  className,
}: SettingsLayoutProps): React.JSX.Element {
  const [section, setSection] = React.useState<SettingsSection>(defaultSection);

  return (
    <div className={cn("flex h-full w-full flex-col bg-background", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <span className="text-sm font-semibold">Settings</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="w-48 shrink-0 border-r border-border p-2">
          {SECTIONS.map((s) => {
            const active = s.id === section;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-auto">
          {section === "mcp" ? (
            <MCPConfigPanel
              servers={servers}
              enabledNames={enabledNames}
              onAdd={onAddServer}
              onUpdate={onUpdateServer}
              onRemove={onRemoveServer}
              onTest={onTestServer}
              onToggleEnabled={onToggleServer}
              className="h-full"
            />
          ) : section === "appearance" ? (
            <AppearanceSection />
          ) : (
            <ShortcutsSection />
          )}
        </div>
      </div>
    </div>
  );
}

function AppearanceSection(): React.JSX.Element {
  const [dark, setDark] = React.useState(false);
  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h3 className="text-sm font-semibold">Theme</h3>
        <p className="text-xs text-muted-foreground">
          Toggle between light and dark mode.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="dark-mode">Dark mode</Label>
          <p className="text-xs text-muted-foreground">
            Uses the system preference when off.
          </p>
        </div>
        <Switch
          id="dark-mode"
          checked={dark}
          onCheckedChange={(v) => {
            setDark(v);
            document.documentElement.classList.toggle("dark", v);
          }}
        />
      </div>
      <Separator />
      <div>
        <h3 className="text-sm font-semibold">Font size</h3>
        <p className="text-xs text-muted-foreground">
          Base font size for the chat transcript.
        </p>
      </div>
      <Input type="number" defaultValue={15} min={12} max={20} />
    </div>
  );
}

function ShortcutsSection(): React.JSX.Element {
  const shortcuts = [
    { keys: "Enter", action: "Send message" },
    { keys: "Shift+Enter", action: "New line" },
    { keys: "Ctrl+K", action: "Command palette" },
    { keys: "Ctrl+B", action: "Toggle sidebar" },
    { keys: "Ctrl+J", action: "Toggle terminal" },
    { keys: "Esc", action: "Cancel generation" },
  ];
  return (
    <div className="mx-auto max-w-xl space-y-3 p-6">
      <div>
        <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
        <p className="text-xs text-muted-foreground">
          Customize key bindings for common actions.
        </p>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {shortcuts.map((s) => (
          <div
            key={s.keys}
            className="flex items-center justify-between px-3 py-2"
          >
            <span className="text-sm">{s.action}</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
