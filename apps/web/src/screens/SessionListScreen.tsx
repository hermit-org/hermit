import React from "react";
import { useTranslation } from "react-i18next";
import { useGatewayStore, useSessionStore } from "../stores";

interface SessionListScreenProps {
  gatewayId: string;
  onOpen: (sessionId: string) => void;
  onBack: () => void;
}

export function SessionListScreen({
  gatewayId,
  onOpen,
  onBack,
}: SessionListScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const gateway = useGatewayStore((state) =>
    state.gateways.find((g) => g.id === gatewayId),
  );
  const { sessions, createSession, deleteSession } = useSessionStore();

  const gatewaySessions = sessions
    .filter((s) => s.gatewayId === gatewayId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleNewSession = (): void => {
    const session = createSession(gatewayId, "New chat");
    onOpen(session.id);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          ‹
        </button>
        <div style={styles.title}>{gateway?.name ?? t("sessions.title")}</div>
        <button style={styles.newButton} onClick={handleNewSession}>
          + {t("sessions.new")}
        </button>
      </div>

      <div style={styles.list}>
        {gatewaySessions.length === 0 ? (
          <div style={styles.empty}>{t("sessions.empty")}</div>
        ) : (
          gatewaySessions.map((s) => (
            <div key={s.id} style={styles.item}>
              <div style={styles.itemMain} onClick={() => onOpen(s.id)}>
                <div style={styles.itemTitle}>{s.title}</div>
                <div style={styles.itemMeta}>
                  {new Date(s.updatedAt).toLocaleString()}
                </div>
              </div>
              <button
                style={styles.deleteButton}
                onClick={() => deleteSession(s.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 640,
    margin: "0 auto",
    padding: 16,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    borderBottom: "1px solid #e5e5e5",
  },
  backButton: {
    background: "none",
    border: "none",
    fontSize: 24,
    color: "#007AFF",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 600,
  },
  newButton: {
    backgroundColor: "#007AFF",
    color: "#fff",
    fontWeight: 600,
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
  },
  list: {
    marginTop: 8,
  },
  item: {
    display: "flex",
    alignItems: "center",
    padding: "14px 0",
    borderBottom: "1px solid #f0f0f0",
  },
  itemMain: {
    flex: 1,
    cursor: "pointer",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 500,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: "#999",
  },
  deleteButton: {
    background: "none",
    border: "none",
    fontSize: 20,
    color: "#ccc",
    cursor: "pointer",
    padding: 0,
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
    color: "#999",
  },
};
