import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, { type Language } from "./i18n";
import { useGatewayStore } from "./stores";
import { readConfigFromUrl } from "./config";
import { ServerListScreen } from "./screens/ServerListScreen";
import { SessionListScreen } from "./screens/SessionListScreen";
import { ChatScreen } from "./screens/ChatScreen";

type View =
  | { name: "serverList" }
  | { name: "sessionList"; gatewayId: string }
  | { name: "chat"; gatewayId: string; sessionId: string };

export default function App(): React.JSX.Element {
  const { t } = useTranslation();
  const { addGateway, gateways } = useGatewayStore();
  const [view, setView] = useState<View>({ name: "serverList" });
  const [notice, setNotice] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(i18n.language as Language);

  // Auto-configure a gateway from URL params (?url=&token=&name=... or ?payload=...).
  // This is how `hermit start` hands connection info to the web client.
  useEffect(() => {
    const config = readConfigFromUrl();
    if (!config) return;

    const exists = gateways.some(
      (g) => g.url === config.url && g.token === config.token,
    );
    if (!exists) {
      addGateway({
        name: config.name || "Hermit Gateway",
        url: config.url,
        sendUrl: config.sendUrl,
        token: config.token,
      });
    }
    setNotice(t("connect.autoImported"));
  }, []); // run once on mount

  const toggleLanguage = (): void => {
    const next: Language = language === "zh" ? "en" : "zh";
    i18n.changeLanguage(next);
    setLanguage(next);
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.brand}>{t("title")}</span>
        <button style={styles.langButton} onClick={toggleLanguage}>
          {language === "zh" ? "EN" : "中"}
        </button>
      </header>

      {notice && view.name === "serverList" && (
        <div style={styles.notice}>{notice}</div>
      )}

      <main style={styles.main}>
        {view.name === "serverList" && (
          <ServerListScreen
            onOpen={(gatewayId) => setView({ name: "sessionList", gatewayId })}
          />
        )}

        {view.name === "sessionList" && (
          <SessionListScreen
            gatewayId={view.gatewayId}
            onOpen={(sessionId) =>
              setView({ name: "chat", gatewayId: view.gatewayId, sessionId })
            }
            onBack={() => setView({ name: "serverList" })}
          />
        )}

        {view.name === "chat" && (
          <ChatScreen
            sessionId={view.sessionId}
            onBack={() =>
              setView({ name: "sessionList", gatewayId: view.gatewayId })
            }
          />
        )}
      </main>
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
  notice: {
    padding: "8px 16px",
    backgroundColor: "#e8f4ff",
    color: "#0066cc",
    fontSize: 13,
  },
  main: {
    flex: 1,
    overflow: "hidden",
  },
};
