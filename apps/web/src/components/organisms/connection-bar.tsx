import * as React from "react";
import { useTranslation } from "react-i18next";
import { LogIn, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import type { AgentCapabilities } from "@hermit-org/acp";
import {
  ConnectionStatusDot,
  ProtocolBadge,
} from "@/components/atoms";
import { ModeSelector } from "@/components/molecules";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  ConnectionStatus,
  SessionMode,
} from "@/components/domain";

export interface ConnectionBarProps {
  /** Transport connection state. */
  status: ConnectionStatus;
  /** Negotiated ACP protocol version. */
  protocolVersion?: string;
  /** Agent capabilities advertised via `initialize` (drives the protocol panel). */
  agentCapabilities?: AgentCapabilities;
  /** Whether the `initialize` handshake completed. */
  initialized?: boolean;
  /** Agent implementation name (e.g. "Codex"). */
  agentName?: string;
  /** Agent-reported capability badges. */
  capabilities?: string[];
  /** Whether the client is authenticated. */
  authenticated?: boolean;
  /** Display name of the authenticated principal. */
  principal?: string;
  /** Available operating modes (when a session is active). */
  modes?: SessionMode[];
  /** Current mode id. */
  currentModeId?: string;
  /** Change the operating mode. */
  onModeChange?: (modeId: string) => void;
  /** Open the auth modal. */
  onAuthenticate?: () => void;
  /** Log out. */
  onLogout?: () => void;
  /** Reconnect when the transport is disconnected/errored. */
  onReconnect?: () => void;
  className?: string;
}

/**
 * Top connection status bar: status dot, protocol version, capability badges,
 * mode selector, and auth actions.
 *
 * @example
 * <ConnectionBar status="connected" protocolVersion="1" agentName="Codex" authenticated modes={modes} currentModeId="code" onModeChange={setMode} />
 */
export function ConnectionBar({
  status,
  protocolVersion,
  agentCapabilities,
  initialized,
  agentName,
  capabilities = [],
  authenticated,
  principal,
  modes,
  currentModeId,
  onModeChange,
  onAuthenticate,
  onLogout,
  onReconnect,
  className,
}: ConnectionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <ConnectionStatusDot status={status} />
        <span className="text-sm font-semibold">
          {agentName ?? t("connection.agentFallback")}
        </span>
      </div>
      <ProtocolBadge
        version={protocolVersion}
        agentCapabilities={agentCapabilities}
        initialized={initialized}
      />

      <div className="ml-auto flex items-center gap-2">
        {onReconnect && (status === "disconnected" || status === "error") ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReconnect}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">{t("chat.reconnect")}</span>
          </Button>
        ) : null}
        {modes && modes.length > 0 && currentModeId && onModeChange ? (
          <ModeSelector
            modes={modes}
            value={currentModeId}
            onChange={onModeChange}
          />
        ) : null}

        <Separator orientation="vertical" className="h-6" />

        {authenticated ? (
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              {principal ?? t("auth.authenticated")}
            </span>
            {onLogout ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t("auth.signOut")}</span>
              </Button>
            ) : null}
          </div>
        ) : onAuthenticate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAuthenticate}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">{t("auth.signIn")}</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
