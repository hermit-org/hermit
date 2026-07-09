/**
 * Real-data entry point for the new Atomic-Design ACP UI.
 *
 * Selects the active gateway from the persisted store (auto-creating one from
 * URL params, mirroring the legacy `App.tsx` auto-import), runs the
 * {@link useAcpPageAdapter} to bridge the legacy runtime onto the new UI's
 * prop contract, and renders `<ACPClientPage />`.
 *
 * When no gateway is configured it shows a minimal inline connect form rather
 * than reaching into the legacy `screens/`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ACPClientPage } from "./acp-client-page";
import { GatewayRegistration } from "./gateway-registration";
import { useAcpPageAdapter } from "../hooks/useAcpPageAdapter";
import { useGatewayStore } from "../stores/gatewayStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useConfigStore } from "../stores/configStore";
import { useAcpClientStore } from "../stores/acpClientStore";
import { useAcpExt } from "../hooks/useAcpExt";
import { readConfigFromUrl } from "../config";
import { navigate } from "../router";
import { readShareFromHash, applySharePayload, clearShareHash } from "@/lib/share";

export interface RealAppProps {
  /** Override the auto-selected gateway id (e.g. from routing). */
  gatewayId?: string;
}

/**
 * New UI wired to the real ACP runtime.
 *
 * @example
 * <RealApp />
 */
export function RealApp({ gatewayId }: RealAppProps): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const activeGatewayId = useGatewayStore((s) => s.activeGatewayId);
  const setActiveGateway = useGatewayStore((s) => s.setActiveGateway);

  // Mirror the legacy App's auto-import of a gateway from URL params so
  // `hermit start` keeps working against the new UI. Read from the live store
  // state (not a closure snapshot) so StrictMode's double-invoke and
  // concurrent renders don't add the gateway twice.
  // Also check for a share-link payload (`#s=...`) and import it.
  useEffect(() => {
    // 1. Share-link import (takes priority — it may carry both gateway + settings)
    const sharePayload = readShareFromHash();
    if (sharePayload) {
      applySharePayload(sharePayload);
      clearShareHash();
    }

    // 2. Legacy connection-string import (hermit start deep link)
    const config = readConfigFromUrl();
    if (!config) return;
    const store = useGatewayStore.getState();
    const exists = store.gateways.some(
      (g) => g.url === config.url && g.token === config.token,
    );
    if (!exists) {
      store.addGateway({
        name: config.name || t("gateways.defaultName"),
        url: config.url,
        sendUrl: config.sendUrl,
        token: config.token,
      });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gateway = useMemo(() => {
    if (gatewayId) return gateways.find((g) => g.id === gatewayId) ?? null;
    if (activeGatewayId) {
      return gateways.find((g) => g.id === activeGatewayId) ?? null;
    }
    return gateways[0] ?? null;
  }, [gateways, activeGatewayId, gatewayId]);

  const adapter = useAcpPageAdapter(gateway);

  // Fire GET /api/config in parallel with the SSE auto-connect inside the
  // adapter. Neither request waits for the other: config data renders the UI
  // immediately (theme, language, agent list), while SSE connects in the
  // background and transitions the status to "online" once established.
  const loadConfig = useConfigStore((s) => s.loadConfig);
  useEffect(() => {
    if (!gateway) return;
    try {
      const origin = new URL(gateway.url).origin;
      void loadConfig(origin);
    } catch {
      // Malformed gateway URL — skip config fetch; SSE proceeds independently.
    }
  }, [gateway?.id, gateway?.url, loadConfig]);

  // ACP extension: multi-agent management (only active when feature flag is on).
  const acpExtEnabled = useSettingsStore((s) => s.acpExt);
  // Activate the ext hook once the transport (SSE) is connected — do NOT wait
  // for `initialize`. The gateway handles `_agent/*` requests independently of
  // the agent process, so the agent switcher can appear before ACP is ready.
  const transportReady = adapter.gatewayStatus === "connected";

  // Register the live AcpClient + connection state into the shared store so
  // other parts of the UI (e.g. SettingsLayout > AgentsSection) can reuse this
  // connection instead of creating their own SSE transport.
  const setSharedClient = useAcpClientStore((s) => s.setClient);
  const setSharedConnectionState = useAcpClientStore((s) => s.setConnectionState);
  useEffect(() => {
    setSharedClient(adapter.client);
  }, [adapter.client, setSharedClient]);
  useEffect(() => {
    setSharedConnectionState(adapter.gatewayStatus ?? "disconnected");
  }, [adapter.gatewayStatus, setSharedConnectionState]);

  const {
    agents: extAgents,
    currentAgentId: extCurrentAgentId,
    switching: extSwitching,
    loading: extLoading,
    error: extError,
    switchAgent: extSwitchAgent,
    reloadAgent: extReloadAgent,
    createAgent: extCreateAgent,
    updateAgent: extUpdateAgent,
    deleteAgent: extDeleteAgent,
    refresh: extRefresh,
  } = useAcpExt(adapter.client, acpExtEnabled, transportReady);

  // D2: Register agent ext data into the shared store so AgentsSection can
  // consume it without calling `useAcpExt` a second time.
  const setExtData = useAcpClientStore((s) => s.setExtData);
  useEffect(() => {
    if (!acpExtEnabled) return;
    setExtData({
      agents: extAgents,
      currentAgentId: extCurrentAgentId,
      loading: extLoading,
      error: extError,
      switching: extSwitching,
      createAgent: extCreateAgent,
      updateAgent: extUpdateAgent,
      deleteAgent: extDeleteAgent,
      switchAgent: extSwitchAgent,
      reloadAgent: extReloadAgent,
      refresh: extRefresh,
    });
  }, [
    acpExtEnabled,
    extAgents,
    extCurrentAgentId,
    extLoading,
    extError,
    extSwitching,
    extCreateAgent,
    extUpdateAgent,
    extDeleteAgent,
    extSwitchAgent,
    extReloadAgent,
    extRefresh,
    setExtData,
  ]);

  // B2: When the active agent changes (and we had a previous agent), inject a
  // divider ChatItem so the transcript shows where the switch happened.
  const prevAgentIdRef = useRef<string | null>(null);
  const [agentSwitchLabels, setAgentSwitchLabels] = useState<
    { key: string; label: string; createdAt: number }[]
  >([]);
  useEffect(() => {
    if (!acpExtEnabled) return;
    const prevId = prevAgentIdRef.current;
    // Only inject when transitioning from one agent to a different one.
    if (
      prevId !== null &&
      extCurrentAgentId !== null &&
      prevId !== extCurrentAgentId
    ) {
      const switchedAgent = extAgents.find((a) => a.id === extCurrentAgentId);
      const name = switchedAgent?.name ?? extCurrentAgentId;
      setAgentSwitchLabels((prev) => [
        ...prev,
        {
          key: `agent-switch-${Date.now()}`,
          label: t("agents.switchDivider", { name }),
          createdAt: Date.now(),
        },
      ]);
    }
    prevAgentIdRef.current = extCurrentAgentId;
  }, [extCurrentAgentId, extAgents, acpExtEnabled, t]);

  // Merge agent-switch dividers into the chat items from the adapter.
  const chatItemsWithDividers = useMemo(() => {
    if (agentSwitchLabels.length === 0) return adapter.chatItems;
    const dividers = agentSwitchLabels.map((d) => ({
      kind: "divider" as const,
      key: d.key,
      label: d.label,
      createdAt: d.createdAt,
    }));
    return [...adapter.chatItems, ...dividers];
  }, [adapter.chatItems, agentSwitchLabels]);

  const handleGatewayAdded = useCallback(
    (id: string) => {
      setActiveGateway(id);
    },
    [setActiveGateway],
  );

  if (!gateway) {
    return <GatewayRegistration onAdded={handleGatewayAdded} />;
  }

  // Normalize `activeSessionId: string | null` → `string | undefined` to
  // match ACPClientPageProps without loosening the adapter's own contract.
  const { activeSessionId, ...rest } = adapter;
  return (
    <ACPClientPage
      {...rest}
      activeSessionId={activeSessionId ?? undefined}
      chatItems={chatItemsWithDividers}
      agents={acpExtEnabled ? extAgents : []}
      currentAgentId={acpExtEnabled ? extCurrentAgentId : undefined}
      onSwitchAgent={acpExtEnabled ? extSwitchAgent : undefined}
      onReloadAgent={acpExtEnabled ? extReloadAgent : undefined}
      agentSwitching={acpExtEnabled ? extSwitching : false}
      onOpenSettings={() => navigate("/settings")}
    />
  );
}
