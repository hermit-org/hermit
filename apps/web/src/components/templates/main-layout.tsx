import * as React from "react";
import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { ConnectionBar } from "@/components/organisms/connection-bar";
import { SessionSidebar } from "@/components/organisms/session-sidebar";
import { ChatArea } from "@/components/organisms/chat-area";
import { ToolCallPanel } from "@/components/organisms/tool-call-panel";
import { MessageComposerPanel } from "@/components/organisms/message-composer-panel";
import { StatusBar } from "@/components/organisms/status-bar";
import { PermissionModal } from "@/components/organisms/permission-modal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import {
  MOCK_CHAT_ITEMS,
  MOCK_COMMANDS,
  MOCK_CONNECTION,
  MOCK_MODES,
  MOCK_PERMISSIONS,
  MOCK_SESSIONS,
  MOCK_TAGS,
  MOCK_TOOL_CALLS,
  MOCK_USAGE,
} from "./mock-data";

export interface MainLayoutProps {
  /** Render with mock data (template preview) or real children. */
  withMockData?: boolean;
  /** Children rendered in the chat column when not using mock data. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Main application layout template: connection bar on top, session sidebar on
 * the left, chat column in the center, an optional right tool panel, a message
 * composer, and a status bar at the bottom. Responsive: sidebar collapses to
 * a drawer on small screens.
 *
 * @example
 * <MainLayout withMockData />
 */
export function MainLayout({
  withMockData,
  children,
  className,
}: MainLayoutProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    sidebarOpen,
    setSidebarOpen,
    rightPanelOpen,
    setRightPanelOpen,
  } = useSettingsStore();

  return (
    <div className={cn("flex h-full w-full flex-col bg-background", className)}>
      <ConnectionBar
        status={MOCK_CONNECTION}
        protocolVersion="1"
        agentName="Codex"
        capabilities={["fs.read", "fs.write", "terminal", "session.list"]}
        authenticated
        principal="dev@hermit"
        modes={MOCK_MODES}
        currentModeId="code"
        onModeChange={() => {}}
      />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <div
          className={cn(
            "hidden shrink-0 overflow-hidden md:block",
            sidebarOpen ? "w-64" : "w-0",
            "transition-[width] duration-200",
          )}
        >
          {sidebarOpen ? (
            <SessionSidebar
              sessions={MOCK_SESSIONS}
              activeId="s1"
              availableTags={MOCK_TAGS}
              canFork
              canResume
              canClose
            />
          ) : null}
        </div>

        {/* Center column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-border px-2 py-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7"
                  aria-label={t("layout.toggleSidebar")}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("layout.toggleSidebar")}</TooltipContent>
            </Tooltip>
            <span className="px-1 text-xs text-muted-foreground">
              Refactor parser module
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto h-7 w-7"
                  aria-label={t("layout.toggleRightPanel")}
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                >
                  {rightPanelOpen ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("layout.toggleRightPanel")}</TooltipContent>
            </Tooltip>
          </div>

          <div className="min-h-0 flex-1">
            {children ?? (
              <ChatArea items={MOCK_CHAT_ITEMS} assistantName="Codex" />
            )}
          </div>

          <MessageComposerPanel
            value=""
            onChange={() => {}}
            onSubmit={() => {}}
            commands={MOCK_COMMANDS}
            busy
            onCancel={() => {}}
          />
        </div>

        {/* Right panel */}
        <div
          className={cn(
            "hidden shrink-0 overflow-hidden border-l border-border lg:block",
            rightPanelOpen ? "w-80" : "w-0",
            "transition-[width] duration-200",
          )}
        >
          {rightPanelOpen ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-2 py-1">
                <span className="text-xs font-semibold">{t("tool.title")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6"
                  aria-label={t("common.close")}
                  onClick={() => setRightPanelOpen(false)}
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ToolCallPanel calls={MOCK_TOOL_CALLS} className="h-[calc(100%-2rem)]" />
            </>
          ) : null}
        </div>
      </div>

      <StatusBar
        status={MOCK_CONNECTION}
        modeId="code"
        usage={MOCK_USAGE}
        contextWindow={200000}
        busy
      />

      <PermissionModal
        requests={MOCK_PERMISSIONS}
        onResolve={() => {}}
      />
    </div>
  );
}
