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
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ACPClientPage } from "./acp-client-page";
import { GatewayRegistration } from "./gateway-registration";
import { useAcpPageAdapter } from "../hooks/useAcpPageAdapter";
import { useGatewayStore } from "../stores/gatewayStore";
import { readConfigFromUrl } from "../config";
import { navigate } from "../router";

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
  useEffect(() => {
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
      onOpenSettings={() => navigate("/settings")}
    />
  );
}
