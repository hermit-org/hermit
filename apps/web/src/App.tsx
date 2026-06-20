import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, { type Language } from "./i18n";
import { useGatewayStore } from "./stores";
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
  const [language, setLanguage] = useState<Language>(i18n.language as Language);

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
        name: config.name || "Hermit Gateway",
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

  const toggleLanguage = (): void => {
    const next: Language = language === "zh" ? "en" : "zh";
    i18n.changeLanguage(next);
    setLanguage(next);
  };

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
        <ModeSwitcher route={route} />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.brand}>{t("title")}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            style={{ ...styles.langButton, fontSize: 11 }}
            onClick={() => navigate("/")}
            title="Switch to the new UI"
          >
            New UI
          </button>
          <button style={styles.langButton} onClick={toggleLanguage}>
            {language === "zh" ? "EN" : "中"}
          </button>
        </div>
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

/** Floating mode switcher shown over the full-screen new UI. */
function ModeSwitcher({ route }: { route: Route }): React.JSX.Element {
  const active =
    route.name === "showcase"
      ? "showcase"
      : route.name === "settings"
        ? "settings"
        : route.name === "real"
          ? "real"
          : "gateways";
  const options: { id: string; label: string; to: string }[] = [
    { id: "gateways", label: "Gateways", to: "/" },
    { id: "showcase", label: "Preview", to: "/showcase" },
    { id: "settings", label: "Settings", to: "/settings" },
    { id: "legacy", label: "Legacy", to: "/legacy" },
  ];
  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 50,
        display: "flex",
        gap: 4,
        background: "hsl(0 0% 100%)",
        border: "1px solid hsl(0 0% 90%)",
        borderRadius: 8,
        padding: 4,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          style={{
            border: "none",
            background: active === opt.id ? "hsl(0 0% 10%)" : "transparent",
            color: active === opt.id ? "#fff" : "hsl(0 0% 40%)",
            borderRadius: 5,
            padding: "4px 8px",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 600,
          }}
          onClick={() => navigate(opt.to)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
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
  langButton: {
    background: "none",
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    cursor: "pointer",
    color: "#333",
  },
  main: {
    flex: 1,
    overflow: "hidden",
  },
};
