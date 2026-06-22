import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "./i18n";
import { useGatewayStore, useSettingsStore } from "./stores";
import { readConfigFromUrl } from "./config";
import { GatewayManager, RealApp, SettingsPage } from "./pages";
import type { Gateway } from "./types";
import { navigate, useRoute, realGatewayPath, type Route } from "./router";

/**
 * Root component. Routing is path-based (see `src/router.ts`):
 *
 *   /                 → GatewayManager (landing)
 *   /g/:gatewayId     → RealApp chat for a gateway
 *   /settings         → settings page
 *
 * On first load, a gateway carried via `?url=…&token=…` (how `hermit start`
 * hands off config) is auto-imported and the user is dropped straight into chat.
 */
export default function App(): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const { language } = useSettingsStore();

  useEffect(() => {
    changeAppLanguage(language);
  }, [language]);

  useEffect(() => {
    const config = readConfigFromUrl();
    if (!config) return;
    const store = useGatewayStore.getState();
    const existing = store.gateways.find(
      (g) => g.url === config.url && g.token === config.token,
    );
    const g =
      existing ??
      store.addGateway({
        name: config.name || t("gateways.defaultName"),
        url: config.url,
        sendUrl: config.sendUrl,
        token: config.token,
      });
    if (window.location.pathname === "/") {
      navigate(realGatewayPath(g.id), { replace: true });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const route = useRoute();

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <FullScreenRoute route={route} gateways={gateways} />
    </div>
  );
}

function FullScreenRoute({
  route,
  gateways,
}: {
  route: Route;
  gateways: Gateway[];
}): React.JSX.Element {
  switch (route.name) {
    case "gateways":
      return (
        <GatewayManager onConnect={(id) => navigate(realGatewayPath(id))} />
      );
    case "real": {
      const exists = gateways.some((g) => g.id === route.gatewayId);
      if (!exists) {
        return (
          <GatewayManager onConnect={(id) => navigate(realGatewayPath(id))} />
        );
      }
      return <RealApp gatewayId={route.gatewayId} />;
    }
    case "settings":
      return <SettingsPage onBack={() => navigate("/")} />;
    default:
      return (
        <GatewayManager onConnect={(id) => navigate(realGatewayPath(id))} />
      );
  }
}
