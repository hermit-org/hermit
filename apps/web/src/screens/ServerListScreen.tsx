import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGatewayStore } from "../stores";
import { parseConnectionString } from "../config";
import type { Gateway } from "../types";

interface ServerListScreenProps {
  onOpen: (gatewayId: string) => void;
}

export function ServerListScreen({ onOpen }: ServerListScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const { gateways, addGateway, updateGateway, removeGateway, setActiveGateway } =
    useGatewayStore();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const resetForm = (): void => {
    setName("");
    setUrl("");
    setToken("");
    setEditingId(null);
  };

  const handleSave = (): void => {
    if (!name.trim() || !url.trim() || !token.trim()) {
      setNotice(t("gateways.empty"));
      return;
    }

    if (editingId) {
      updateGateway(editingId, {
        name: name.trim(),
        url: url.trim(),
        token: token.trim(),
      });
    } else {
      addGateway({
        name: name.trim(),
        url: url.trim(),
        token: token.trim(),
        sendUrl: "",
      });
    }
    resetForm();
  };

  const handleEdit = (gateway: Gateway): void => {
    setEditingId(gateway.id);
    setName(gateway.name);
    setUrl(gateway.url);
    setToken(gateway.token);
  };

  const handleDelete = (id: string): void => {
    if (window.confirm(t("gateways.deleteConfirm"))) {
      removeGateway(id);
    }
  };

  const handleSelect = (gateway: Gateway): void => {
    setActiveGateway(gateway.id);
    onOpen(gateway.id);
  };

  const handleImport = (): void => {
    const config = parseConnectionString(pasteValue);
    if (!config) {
      setNotice(t("connect.invalid"));
      return;
    }
    addGateway({
      name: config.name || "Imported Gateway",
      url: config.url,
      sendUrl: config.sendUrl,
      token: config.token,
    });
    setPasteValue("");
    setNotice(t("connect.imported"));
  };

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <input
          style={styles.input}
          placeholder={t("connect.paste")}
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
        />
        <button style={styles.secondaryButton} onClick={handleImport}>
          {t("connect.import")}
        </button>
      </div>

      <div style={styles.section}>
        <input
          style={styles.input}
          placeholder={t("gateways.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder={t("gateways.url")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoCapitalize="none"
        />
        <input
          style={styles.input}
          placeholder={t("gateways.token")}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
          autoCapitalize="none"
        />
        <button style={styles.button} onClick={handleSave}>
          {editingId ? t("gateways.update") : t("gateways.add")}
        </button>
        {editingId && (
          <button style={styles.cancelButton} onClick={resetForm}>
            {t("gateways.cancel")}
          </button>
        )}
      </div>

      {notice && <div style={styles.notice}>{notice}</div>}

      <div style={styles.list}>
        {gateways.length === 0 ? (
          <div style={styles.empty}>{t("gateways.empty")}</div>
        ) : (
          gateways.map((gw) => (
            <div key={gw.id} style={styles.item}>
              <div style={styles.itemMain} onClick={() => handleSelect(gw)}>
                <div style={styles.itemName}>{gw.name}</div>
                <div style={styles.itemUrl}>{gw.url}</div>
              </div>
              <div style={styles.itemActions}>
                <button style={styles.linkButton} onClick={() => handleEdit(gw)}>
                  {t("gateways.edit")}
                </button>
                <button
                  style={{ ...styles.linkButton, color: "#ff3b30" }}
                  onClick={() => handleDelete(gw.id)}
                >
                  {t("gateways.delete")}
                </button>
              </div>
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
  section: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    fontSize: 15,
    border: "1px solid #d1d1d1",
    borderRadius: 8,
    outline: "none",
  },
  button: {
    padding: "10px 16px",
    backgroundColor: "#007AFF",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    padding: "10px 16px",
    backgroundColor: "#f0f0f0",
    color: "#333",
    fontSize: 15,
    border: "1px solid #ddd",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  cancelButton: {
    padding: "10px 16px",
    backgroundColor: "transparent",
    color: "#666",
    fontSize: 15,
    border: "1px solid #ddd",
    borderRadius: 8,
    cursor: "pointer",
  },
  notice: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
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
  itemName: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 2,
  },
  itemUrl: {
    fontSize: 13,
    color: "#666",
  },
  itemActions: {
    display: "flex",
    gap: 12,
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#007AFF",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
    color: "#999",
  },
};
