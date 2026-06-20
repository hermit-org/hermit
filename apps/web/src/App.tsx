import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "./i18n";
import { useGatewayStore, useSettingsStore } from "./stores";
import { readConfigFromUrl } from "./config";
import { ServerListScreen } from "./screens/ServerListScreen";
import { SessionListScreen } from "./screens/SessionListScreen";
import { ChatScreen } from "./screens/ChatScreen";
import {
  RealApp,
  ShowcasePage,
  SettingsPage,
  GatewayManager,
} from "./pages";
import type { Gateway } from "./types";
import {
  navigate,
  useRoute,
  realGatewayPath,
  legacyGatewayPath,
  legacySessionPath,
  type Route,
} from "./router";

/**
 * Root component. Routing is path-based (see `src/router.ts`):
 *
 *   /                                 → GatewayManager (landing)
 *   /g/:gatewayId                     → RealApp chat for a gateway
 *   /showcase                         → design preview (mock data)
 *   /settings                         → settings page
 *   /legacy                           → legacy gateway list
 *   /legacy/g/:gatewayId              → legacy session list
 *   /legacy/g/:gatewayId/s/:sessionId → legacy chat
 *
 * On first load, `?legacy` / `?showcase` are migrated to their paths, and a
 * gateway carried via `?url=…&token=…` (how `hermit start` hands off config)
 * is auto-imported and the user is dropped straight into chat.
 */
export default function App(): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const { language } = useSettingsStore();

  useEffect(() => {
    changeAppLanguage(language);
  }, [language]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === "/") {
      if (params.has("legacy")) {
        navigate("/legacy", { replace: true });
        return;
      }
      if (params.has("showcase")) {
        navigate("/showcase", { replace: true });
        return;
      }
    }
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

  const fullScreen =
    route.name === "gateways" ||
    route.name === "real" ||
    route.name === "showcase" ||
    route.name === "settings";

  if (fullScreen) {
    return (
      <div style={{ height: "100vh", position: "relative" }}>
        <FullScreenRoute route={route} gateways={gateways} />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.brand}>{t("title")}</span>
        <button
          style={{ ...styles.langButton, fontSize: 11 }}
          onClick={() => navigate("/")}
          title={t("layout.newUi")}
        >
          {t("layout.newUi")}
        </button>
      </header>

      <main style={styles.main}>
        <LegacyRoute route={route} />
      </main>
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
    case "showcase":
      return <ShowcasePage />;
    case "settings":
      return <SettingsPage onBack={() => navigate("/")} />;
    default:
      return (
        <GatewayManager onConnect={(id) => navigate(realGatewayPath(id))} />
      );
  }
}

function LegacyRoute({ route }: { route: Route }): React.JSX.Element {
  switch (route.name) {
    case "legacy-server-list":
      return (
        <ServerListScreen
          onOpen={(gatewayId) => navigate(legacyGatewayPath(gatewayId))}
        />
      );
    case "legacy-session-list":
      return (
        <SessionListScreen
          gatewayId={route.gatewayId}
          onOpen={(sessionId) =>
            navigate(legacySessionPath(route.gatewayId, sessionId))
          }
          onBack={() => navigate("/legacy")}
        />
      );
    case "legacy-chat":
      return (
        <ChatScreen
          sessionId={route.sessionId}
          onBack={() => navigate(legacyGatewayPath(route.gatewayId))}
        />
      );
    default:
      return (
        <ServerListScreen
          onOpen={(gatewayId) => navigate(legacyGatewayPath(gatewayId))}
        />
      );
  }
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    height: 48,
    borderBottom: "1px solid #e5e5e5",
    backgroundColor: "#fff",
  },
  brand: {
    fontSize: 17,
    fontWeight: 700,
  },
  main: {
    flex: 1,
    overflow: "hidden",
  },
};
