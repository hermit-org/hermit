import * as React from "react";
import { SettingsLayout } from "@/components/templates/settings-layout";
import type { McpServerConfig } from "@/components/domain";
import type { McpServerEntry } from "@/components/domain";

export interface SettingsPageProps {
  /** Configured MCP servers. */
  servers?: McpServerEntry[];
  /** Enabled server names. */
  enabledNames?: Set<string>;
  /** Add an MCP server config. */
  onAddServer?: (config: McpServerConfig) => void;
  /** Update an MCP server config. */
  onUpdateServer?: (name: string, config: McpServerConfig) => void;
  /** Remove an MCP server config. */
  onRemoveServer?: (name: string) => void;
  /** Test an MCP server connection. */
  onTestServer?: (name: string) => void;
  /** Toggle an MCP server enabled state. */
  onToggleServer?: (name: string, enabled: boolean) => void;
  /** Navigate back to the previous view. */
  onBack?: () => void;
}

/**
 * Settings page: wires MCP server CRUD and theme/shortcut preferences to the
 * SettingsLayout. Handles local theme state and persists user choices.
 *
 * @example
 * <SettingsPage servers={servers} onAddServer={add} onBack={back} />
 */
export function SettingsPage({
  servers,
  enabledNames,
  onAddServer,
  onUpdateServer,
  onRemoveServer,
  onTestServer,
  onToggleServer,
  onBack,
}: SettingsPageProps): React.JSX.Element {
  // Restore the persisted dark-mode preference on mount.
  React.useEffect(() => {
    const stored = localStorage.getItem("hermit-theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return (
    <SettingsLayout
      onBack={onBack}
      servers={servers}
      enabledNames={enabledNames}
      onAddServer={onAddServer}
      onUpdateServer={onUpdateServer}
      onRemoveServer={onRemoveServer}
      onTestServer={onTestServer}
      onToggleServer={onToggleServer}
    />
  );
}
