import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGatewayStore, useSessionStore } from "../stores";
import { useAcpClient } from "../acp/hooks";
import type { SessionInfo } from "@hermit/acp";

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

  // Connect the ACP client so we can query the agent's session list / delete
  // sessions server-side. Connection is best-effort; failures fall back to a
  // local-only view.
  const { client, connected, client: clientRef } = useAcpClient({
    gateway: gateway ?? null,
    autoConnect: true,
  });

  const [agentSessions, setAgentSessions] = useState<SessionInfo[]>([]);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const supportsList =
    client?.initializeResult?.agentCapabilities?.sessionCapabilities?.list !=
    null;

  // Fetch the agent-side session list once connected (and when the agent
  // advertises the `list` capability).
  useEffect(() => {
    if (!client || !connected || !supportsList) return;
    let cancelled = false;
    setLoadingAgent(true);
    setAgentError(null);
    client
      .sessionList()
      .then((result) => {
        if (!cancelled) setAgentSessions(result.sessions);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setAgentError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingAgent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, connected, supportsList]);

  const gatewaySessions = sessions
    .filter((s) => s.gatewayId === gatewayId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  // Local session IDs that are already linked to an agent session, so we can
  // avoid duplicating them in the "agent sessions" list.
  const linkedAcpIds = new Set(
    gatewaySessions.map((s) => s.acpSessionId).filter(Boolean) as string[],
  );
  const unlinkedAgentSessions = agentSessions.filter(
    (s) => !linkedAcpIds.has(s.sessionId),
  );

  const handleNewSession = (): void => {
    const session = createSession(gatewayId, "New chat");
    onOpen(session.id);
  };

  // Open an agent-side session: create a local session linked to the agent's
  // sessionId. ChatScreen will then `session/load` / `session/resume` it.
  const handleOpenAgent = (info: SessionInfo): void => {
    const session = createSession(
      gatewayId,
      info.title ?? "Agent session",
      info.sessionId,
    );
    onOpen(session.id);
  };

  // Delete a local session and, if it has an agent-side counterpart and the
  // agent supports `session/delete`, also delete it server-side.
  const handleDelete = (sessionId: string): void => {
    const local = sessions.find((s) => s.id === sessionId);
    const acpId = local?.acpSessionId;
    const supportsDelete =
      client?.initializeResult?.agentCapabilities?.sessionCapabilities
        ?.delete != null;

    const confirmMsg = acpId && supportsDelete
      ? t("sessions.deleteAgentConfirm")
      : undefined;
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    deleteSession(sessionId);

    if (acpId && supportsDelete && clientRef) {
      clientRef
        .sessionDelete({ sessionId: acpId })
        .catch((e: unknown) => {
          // Surface but don't block the local deletion.
          setAgentError(
            `session/delete failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
  };

  // Delete an agent-only session (no local counterpart).
  const handleDeleteAgent = (info: SessionInfo): void => {
    if (!clientRef) return;
    if (!window.confirm(t("sessions.deleteAgentOnly"))) return;
    clientRef
      .sessionDelete({ sessionId: info.sessionId })
      .then(() => {
        setAgentSessions((prev) =>
          prev.filter((s) => s.sessionId !== info.sessionId),
        );
      })
      .catch((e: unknown) => {
        setAgentError(e instanceof Error ? e.message : String(e));
      });
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

      {agentError && <div style={styles.error}>⚠ {agentError}</div>}

      {/* Agent-side sessions (requires sessionCapabilities.list) */}
      {supportsList && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            {t("sessions.agentSessions")}
            {loadingAgent ? ` · ${t("sessions.loading")}` : ""}
          </div>
          {unlinkedAgentSessions.length === 0 && !loadingAgent && (
            <div style={styles.empty}>{t("sessions.empty")}</div>
          )}
          {unlinkedAgentSessions.map((s) => (
            <div key={s.sessionId} style={styles.item}>
              <div style={styles.itemMain} onClick={() => handleOpenAgent(s)}>
                <div style={styles.itemTitle}>
                  {s.title ?? s.sessionId.slice(0, 12)}
                </div>
                <div style={styles.itemMeta}>
                  {s.updatedAt ?? s.cwd}
                </div>
              </div>
              <button
                style={styles.openButton}
                onClick={() => handleOpenAgent(s)}
              >
                {t("sessions.openAgent")}
              </button>
              <button
                style={styles.deleteButton}
                onClick={() => handleDeleteAgent(s)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Local sessions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t("sessions.localSessions")}</div>
        {gatewaySessions.length === 0 && !supportsList && (
          <div style={styles.empty}>{t("sessions.empty")}</div>
        )}
        {gatewaySessions.map((s) => (
          <div key={s.id} style={styles.item}>
            <div style={styles.itemMain} onClick={() => onOpen(s.id)}>
              <div style={styles.itemTitle}>
                {s.title}
                {s.closed && <span style={styles.closedTag}> closed</span>}
              </div>
              <div style={styles.itemMeta}>
                {new Date(s.updatedAt).toLocaleString()}
              </div>
            </div>
            <button
              style={styles.deleteButton}
              onClick={() => handleDelete(s.id)}
            >
              ×
            </button>
          </div>
        ))}
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
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#999",
    marginBottom: 8,
  },
  error: {
    marginTop: 8,
    padding: "8px 12px",
    backgroundColor: "#fdecea",
    color: "#c62828",
    borderRadius: 8,
    fontSize: 13,
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
  closedTag: {
    fontSize: 11,
    color: "#999",
    fontWeight: 400,
  },
  itemMeta: {
    fontSize: 12,
    color: "#999",
  },
  openButton: {
    background: "none",
    border: "1px solid #007AFF",
    color: "#007AFF",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    cursor: "pointer",
    marginRight: 8,
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
