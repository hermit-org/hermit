import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AuthMethod } from "@hermit-org/acp";

interface AuthPanelProps {
  authMethods: AuthMethod[];
  canLogout: boolean;
  authenticated: boolean;
  onAuthenticate: (methodId: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

/**
 * Surfaces ACP authentication state.
 *
 * - When the agent advertises `authMethods` and the user has not yet
 *   authenticated, a sign-in prompt with one button per method is shown.
 * - When authenticated and `logout` is supported, a sign-out control is shown.
 */
export function AuthPanel({
  authMethods,
  canLogout,
  authenticated,
  onAuthenticate,
  onLogout,
}: AuthPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const needsAuth = authMethods.length > 0 && !authenticated;
  const showSignOut = authenticated && canLogout;

  if (!needsAuth && !showSignOut) return null;

  const handleSignIn = async (methodId: string): Promise<void> => {
    setBusyId(methodId);
    try {
      await onAuthenticate(methodId);
    } finally {
      setBusyId(null);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    setBusyId("logout");
    try {
      await onLogout();
    } finally {
      setBusyId(null);
    }
  };

  if (needsAuth) {
    return (
      <div style={styles.banner}>
        <span style={styles.bannerText}>{t("auth.required")}</span>
        {authMethods.map((method) => (
          <button
            key={method.id}
            type="button"
            style={styles.button}
            disabled={busyId !== null}
            onClick={() => handleSignIn(method.id)}
            title={method.description}
          >
            {busyId === method.id ? "…" : method.name ?? t("auth.signIn")}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      style={styles.signOut}
      disabled={busyId !== null}
      onClick={handleSignOut}
    >
      {busyId === "logout" ? "…" : t("auth.signOut")}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    backgroundColor: "#fff4e5",
    borderBottom: "1px solid #ffd9a6",
    color: "#9a5b00",
    fontSize: 13,
    flexWrap: "wrap",
  },
  bannerText: {
    fontWeight: 600,
  },
  button: {
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  signOut: {
    background: "none",
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    color: "#666",
    cursor: "pointer",
  },
};
