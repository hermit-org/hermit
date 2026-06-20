import * as React from "react";
import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, MessageCirclePlus } from "lucide-react";
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
} from "@/components/templates";
import { ConnectionBar } from "@/components/organisms/connection-bar";
import { SessionSidebar, type SessionSummary } from "@/components/organisms/session-sidebar";
import { ChatArea, type ChatItem } from "@/components/organisms/chat-area";
import { ToolCallPanel } from "@/components/organisms/tool-call-panel";
import { MessageComposerPanel } from "@/components/organisms/message-composer-panel";
import { StatusBar } from "@/components/organisms/status-bar";
import { ToolQuestionsPanel } from "@/components/organisms/tool-questions-panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ErrorBoundary } from "./error-boundary";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import type {
  AvailableCommand,
  ConfigOption,
  SessionMode,
  PlanEntry,
} from "@hermit/acp";
import type {
  ConnectionStatus,
  PendingPermission,
  ToolCallState,
  UsageStats,
  AnsweredPermissionView,
} from "@/components/domain";

export interface ACPClientPageProps {
  /** Transport connection state. */
  connectionStatus?: ConnectionStatus;
  /** Whether the agent requires authentication and the user is not authed. */
  requireAuth?: boolean;
  /** Protocol version. */
  protocolVersion?: string;
  /** Agent implementation name. */
  agentName?: string;
  /** Agent-reported capability badges. */
  capabilities?: string[];
  /** Whether the client is authenticated. */
  authenticated?: boolean;
  /** Whether the agent supports `logout`. */
  canLogout?: boolean;
  /** Negotiated operating modes. */
  modes?: SessionMode[];
  /** Current mode id. */
  currentModeId?: string;
  /** Agent-reported config options (model / mode / thinking …). */
  configOptions?: ConfigOption[];
  /** Sessions. */
  sessions?: SessionSummary[];
  /** Active session id. */
  activeSessionId?: string;
  /** Chat transcript items. */
  chatItems?: ChatItem[];
  /** Tool calls for the side panel (defaults to mock data). */
  toolCalls?: ToolCallState[];
  /** Draft text. */
  draft?: string;
  /** Available commands. */
  commands?: AvailableCommand[];
  /** Whether a turn is streaming. */
  busy?: boolean;
  /** Usage stats. */
  usage?: UsageStats;
  /** Pending permission requests. */
  permissions?: PendingPermission[];
  /** Known tags. */
  tags?: typeof MOCK_TAGS;
  /** Runtime / setup error to surface (dismissable). */
  error?: string | null;
  /** Dismiss the displayed error. */
  onDismissError?: () => void;
  /** Reconnect when the transport is disconnected/errored. */
  onReconnect?: () => void;
  /** Agent-reported plan / todo for the active session. */
  plan?: PlanEntry[];
  /** Number of prompts queued behind the in-flight turn. */
  queueDepth?: number;
  /** Previously-answered permission requests, for history display. */
  permissionHistory?: AnsweredPermissionView[];
  /** Auth methods advertised by the agent. */
  authMethods?: { id: string; name: string; description?: string }[];
  /** Select a session. */
  onSelectSession?: (id: string) => void;
  /** Create a new session. */
  onCreateSession?: () => void;
  /** Delete a session. */
  onDeleteSession?: (id: string) => void;
  /** Change the operating mode. */
  onModeChange?: (modeId: string) => void;
  /** Update the draft. */
  onDraftChange?: (value: string) => void;
  /** Submit a prompt. */
  onPrompt?: (value: string) => void;
  /** Cancel the current turn. */
  onCancel?: () => void;
  /** Close the active agent-side session. */
  onCloseSession?: () => void;
  /** Change an agent config option. */
  onConfigChange?: (optionId: string, value: string) => void;
  /** Resolve a permission request. */
  onResolvePermission?: (
    request: PendingPermission,
    outcome: string | "cancelled",
  ) => void;
  /** Open settings. */
  onOpenSettings?: () => void;
  /** Authenticate. */
  onAuthenticate?: (methodId: string, apiKey: string) => void;
  /** Log out. */
  onLogout?: () => void;
}

/**
 * ACP client main page. Orchestrates global state (connection, auth, sessions,
 * transcript, permissions) and composes the full layout. When props are
 * omitted it falls back to mock data so the UI is immediately previewable.
 *
 * Wraps the tree in an ErrorBoundary and shows the LoginPage as a route guard
 * when `requireAuth` is true.
 *
 * @example
 * <ACPClientPage connectionStatus="connected" sessions={sessions} chatItems={items} onPrompt={send} />
 */
export function ACPClientPage({
  connectionStatus = MOCK_CONNECTION,
  requireAuth,
  protocolVersion = "1",
  agentName,
  capabilities = [],
  authenticated = true,
  canLogout = false,
  modes = MOCK_MODES,
  currentModeId,
  configOptions = [],
  sessions = MOCK_SESSIONS,
  activeSessionId = MOCK_SESSIONS[0]?.id,
  chatItems = MOCK_CHAT_ITEMS,
  toolCalls = MOCK_TOOL_CALLS,
  draft = "",
  commands = MOCK_COMMANDS,
  busy = false,
  usage = MOCK_USAGE,
  permissions = MOCK_PERMISSIONS,
  tags = MOCK_TAGS,
  error,
  onDismissError,
  onReconnect,
  plan,
  queueDepth,
  permissionHistory,
  authMethods = [],
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onModeChange,
  onDraftChange,
  onPrompt,
  onCancel,
  onCloseSession,
  onConfigChange,
  onResolvePermission,
  onOpenSettings,
  onAuthenticate,
  onLogout,
}: ACPClientPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const assistantDisplayName = agentName ?? t("chat.agent");
  const [internalDraft, setInternalDraft] = React.useState(draft);
  const {
    sidebarOpen,
    setSidebarOpen,
    rightPanelOpen,
    setRightPanelOpen,
  } = useSettingsStore();
  const effectiveDraft = onDraftChange ? draft : internalDraft;

  const handleDraftChange = React.useCallback(
    (value: string) => {
      if (onDraftChange) onDraftChange(value);
      else setInternalDraft(value);
    },
    [onDraftChange],
  );

  const handlePrompt = React.useCallback(
    (value: string) => {
      onPrompt?.(value);
      if (!onDraftChange) setInternalDraft("");
    },
    [onPrompt, onDraftChange],
  );

  return (
    <ErrorBoundary>
      <div className="h-full w-full">
        <div className="flex h-full w-full flex-col bg-background">
          <ConnectionBar
            status={connectionStatus}
            protocolVersion={protocolVersion}
            agentName={assistantDisplayName}
            capabilities={capabilities}
            authenticated={authenticated}
            modes={modes}
            currentModeId={currentModeId}
            onModeChange={onModeChange}
            onLogout={canLogout ? onLogout : undefined}
            onReconnect={onReconnect}
          />

          {error ? (
            <ErrorBanner message={error} onDismiss={onDismissError} />
          ) : null}

          {/* Inline auth banner — mirrors the legacy AuthPanel: it does NOT
              gate the UI. The chat stays visible and usable; signing in is
              just an optional action when the agent advertises auth methods. */}
          {requireAuth ? (
            <AuthBanner
              methods={authMethods}
              onAuthenticate={onAuthenticate}
            />
          ) : null}

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
                  sessions={sessions}
                  activeId={activeSessionId}
                  availableTags={tags}
                  canClose
                  onSelect={onSelectSession}
                  onCreate={onCreateSession}
                  onDelete={onDeleteSession}
                />
              ) : null}
            </div>

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
                {onCreateSession ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7"
                        aria-label={t("sessionSidebar.newSession")}
                        onClick={onCreateSession}
                      >
                        <MessageCirclePlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("sessionSidebar.newSession")}</TooltipContent>
                  </Tooltip>
                ) : null}
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
                <ChatArea
                  items={chatItems}
                  assistantName={assistantDisplayName}
                  emptyDescription={
                    busy
                      ? t("chat.agentIsThinking")
                      : t("chat.startConversation")
                  }
                />
              </div>
              {configOptions.length > 0 || onCloseSession ? (
                <ConfigOptionBar
                  options={configOptions}
                  onClose={onCloseSession}
                  onChange={onConfigChange}
                />
              ) : null}
              {plan && plan.length > 0 ? <PlanBar entries={plan} /> : null}
              <ToolQuestionsPanel
                requests={permissions}
                history={permissionHistory}
                onResolve={(req, optionId) =>
                  onResolvePermission?.(req, optionId)
                }
                onCancel={(req) => onResolvePermission?.(req, "cancelled")}
              />
              <MessageComposerPanel
                value={effectiveDraft}
                onChange={handleDraftChange}
                onSubmit={handlePrompt}
                onCancel={onCancel}
                busy={busy}
                disabled={!activeSessionId}
                commands={commands}
                queueDepth={queueDepth}
                onQuickCommand={(cmd) =>
                  handleDraftChange(`/${cmd.name} `)
                }
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
                  <div className="flex items-center border-b border-border px-2 py-1">
                    <span className="text-xs font-semibold">{t("tool.title")}</span>
                  </div>
                  <ToolCallPanel calls={toolCalls} className="h-[calc(100%-2rem)]" />
                </>
              ) : null}
            </div>
          </div>

          <StatusBar
            status={connectionStatus}
            modeId={currentModeId}
            usage={usage}
            busy={busy}
            onOpenSettings={onOpenSettings}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}

/**
 * Compact bar above the composer that renders agent-reported config options
 * (model / mode / thinking …) as selectable chips, mirroring the legacy
 * ChatScreen's meta bar. Select-type options become a dropdown; others show
 * their current value and are not editable here.
 */
function ConfigOptionBar({
  options,
  onClose,
  onChange,
}: {
  options: ConfigOption[];
  onClose?: () => void;
  onChange?: (optionId: string, value: string) => void;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  const selectable = options.filter((o) => o.type === "select");
  if (selectable.length === 0 && !onClose) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-muted/30 px-3 py-1.5">
      {selectable.map((opt) => {
        const current = opt.currentValue;
        const currentLabel =
          opt.options?.find((c) => c.value === current)?.name ?? current;
        return (
          <label
            key={opt.id}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px]"
            title={opt.description ?? opt.name}
          >
            <span className="text-muted-foreground">{opt.name}</span>
            {onChange && opt.options && opt.options.length > 0 ? (
              <select
                className="bg-transparent text-foreground outline-none"
                value={current}
                onChange={(e) => onChange(opt.id, e.target.value)}
              >
                {opt.options.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.name ?? c.value}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium">{currentLabel}</span>
            )}
          </label>
        );
      })}
      {onClose ? (
        <button
          type="button"
          className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          onClick={onClose}
          title={t("config.closeSession")}
        >
          {t("config.closeSession")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Non-blocking inline auth banner, shown when the agent advertises auth
 * methods and the user has not yet authenticated. Mirrors the legacy
 * `AuthPanel`: it does NOT gate the UI — the chat stays visible and usable.
 * Signing in is an optional action (one button per advertised method).
 */
function AuthBanner({
  methods,
  onAuthenticate,
}: {
  methods: { id: string; name: string; description?: string }[];
  onAuthenticate?: (methodId: string, apiKey: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
      <span className="font-semibold">{t("auth.required")}</span>
      {methods.map((m) => (
        <button
          key={m.id}
          type="button"
          className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
          title={m.description}
          onClick={() => onAuthenticate?.(m.id, "")}
        >
          {m.name}
        </button>
      ))}
      <span className="text-muted-foreground">
        {t("auth.stillBrowse")}
      </span>
    </div>
  );
}

/**
 * Dismissable inline error banner. Mirrors the legacy ChatScreen's in-chat
 * `⚠ error` display.
 */
function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-400">
      <span className="font-semibold">⚠ {message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="ml-auto text-[11px] font-medium hover:underline"
          onClick={onDismiss}
        >
          {t("common.dismiss")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Collapsible todo/plan bar shown above the composer. Collapsed (default):
 * shows only the current item + a progress count. Expanded: full list with
 * status dots.
 */
function PlanBar({ entries }: { entries: PlanEntry[] }): React.JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  if (!entries || entries.length === 0) return <></>;
  const completed = entries.filter((e) => e.status === "completed").length;
  const total = entries.length;
  const current =
    entries.find((e) => e.status === "in_progress") ??
    entries.find((e) => e.status !== "completed") ??
    entries[entries.length - 1];
  const allDone = completed === total;

  if (!expanded) {
    return (
      <button
        type="button"
        className="mx-3 mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-left text-xs"
        onClick={() => setExpanded(true)}
      >
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          {t("plan.title")}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {completed}/{total}
        </span>
        <span className="flex-1 truncate">
          {allDone ? t("plan.allDone") : current.content}
        </span>
      </button>
    );
  }

  return (
    <div className="mx-3 mt-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          {t("plan.title")}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {completed}/{total}
        </span>
        <button
          type="button"
          className="ml-auto text-primary hover:underline"
          onClick={() => setExpanded(false)}
        >
          {t("plan.collapse")}
        </button>
      </div>
      {entries.map((e, i) => {
        const status = e.status ?? "pending";
        const dot =
          status === "completed" ? "●" : status === "in_progress" ? "◐" : "○";
        return (
          <div key={i} className="flex items-baseline gap-2 py-0.5">
            <span className="text-muted-foreground">{dot}</span>
            <span
              className={cn(
                "flex-1",
                status === "completed" &&
                  "text-muted-foreground line-through",
                status === "in_progress" && "font-semibold text-primary",
              )}
            >
              {e.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}
