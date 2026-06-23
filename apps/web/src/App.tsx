import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "./i18n";
import { useGatewayStore, useSettingsStore } from "./stores";
import { readConfigFromUrl } from "./config";
import { GatewayRegistration, RealApp, SettingsPage } from "./pages";
import type { Gateway } from "./types";
import { navigate, useRoute, realGatewayPath, type Route } from "./router";

/**
 * Root component. Routing is path-based (see `src/router.ts`):
 *
 *   /                 → smart landing (registration when no gateways,
 *                       otherwise redirects to the active gateway's chat)
 *   /g/:gatewayId     → RealApp chat for a gateway
 *   /settings         → settings page
 *
 * On first load, a gateway carried via `?url=…&token=…` (how `hermit start`
 * hands off config) is auto-imported and the user is dropped straight into chat.
 */
export default function App(): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const activeGatewayId = useGatewayStore((s) => s.activeGatewayId);
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

  // Smart landing: when on `/` with configured gateways, redirect straight to
  // the active (or first) gateway's session list so returning users skip the
  // landing page entirely.
  const landingTargetId = activeGatewayId ?? gateways[0]?.id;
  useEffect(() => {
    if (route.name === "gateways" && landingTargetId) {
      navigate(realGatewayPath(landingTargetId), { replace: true });
    }
  }, [route.name, landingTargetId]);

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
}): React.JSX.Element | null {
  switch (route.name) {
    case "gateways":
      // Has gateways → the App-level effect redirects to /g/:id; render nothing.
      if (gateways.length > 0) return null;
      // No gateways → registration page.
      return (
        <GatewayRegistration
          onAdded={(id) => navigate(realGatewayPath(id))}
        />
      );
    case "real": {
      const exists = gateways.some((g) => g.id === route.gatewayId);
      if (!exists) {
        if (gateways.length === 0) {
          return (
            <GatewayRegistration
              onAdded={(id) => navigate(realGatewayPath(id))}
            />
          );
        }
        return null;
      }
      return <RealApp gatewayId={route.gatewayId} />;
    }
    case "settings":
      return <SettingsPage onBack={() => navigate("/")} />;
    default:
      if (gateways.length === 0) {
        return (
          <GatewayRegistration
            onAdded={(id) => navigate(realGatewayPath(id))}
          />
        );
      }
      return null;
  }
}
