import React, { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "./i18n";
import { useGatewayStore, useSettingsStore } from "./stores";
import { readConfigFromUrl } from "./config";
import { GatewayRegistration, RealApp, SettingsPage } from "./pages";
import { navigate, useRoute, realGatewayPath } from "./router";

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
    if (typeof window !== "undefined" && window.location.pathname === "/") {
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

  // Stable callback shared by all GatewayRegistration instances so children
  // don't receive a new handler reference on every render.
  const handleGatewayAdded = useCallback((id: string) => {
    navigate(realGatewayPath(id));
  }, []);

  // Resolve the gateway id used for the persistent RealApp instance. When the
  // user navigates to /settings we keep the *current* gateway's RealApp alive
  // in the background (hidden) so its SSE connection and loaded data are not
  // torn down. Returning from settings simply hides the overlay, leaving the
  // connection and all session state untouched.
  const persistentGatewayId = useMemo(() => {
    if (route.name === "real") return route.gatewayId;
    // settings / landing / unknown — fall back to the active gateway so the
    // background instance matches what the user was viewing.
    return activeGatewayId ?? gateways[0]?.id ?? null;
  }, [route, activeGatewayId, gateways]);

  const persistentGatewayExists =
    persistentGatewayId != null &&
    gateways.some((g) => g.id === persistentGatewayId);

  // Whether to show the settings overlay on top of the (hidden) RealApp.
  const showSettings = route.name === "settings";

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      {persistentGatewayExists ? (
        <div
          style={{
            height: "100%",
            // Keep the RealApp mounted but visually hidden while the settings
            // overlay is open, so SSE/state survive the round trip.
            display: showSettings ? "none" : "block",
          }}
        >
          <RealApp gatewayId={persistentGatewayId!} />
        </div>
      ) : null}

      {/* Registration page when there are no gateways at all. */}
      {!persistentGatewayExists && route.name !== "settings" ? (
        <GatewayRegistration onAdded={handleGatewayAdded} />
      ) : null}

      {/* Settings overlay rendered on top so the background instance stays alive. */}
      {showSettings ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <SettingsPage
            onBack={() =>
              navigate(
                persistentGatewayId
                  ? realGatewayPath(persistentGatewayId)
                  : "/",
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
