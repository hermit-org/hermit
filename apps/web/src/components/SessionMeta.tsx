import React from "react";
import { useTranslation } from "react-i18next";
import type {
  PlanEntry,
  UsageUpdate,
  SessionModeState,
  AvailableCommand,
} from "@hermit-org/acp";

const PRIORITY_COLOR: Record<string, string> = {
  high: "#ea4335",
  medium: "#f5a623",
  low: "#999",
};

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
};

export function PlanView({ entries }: { entries: PlanEntry[] }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div style={styles.card}>
      <div style={styles.title}>{t("plan.title")}</div>
      {entries.map((entry, i) => {
        const priority = entry.priority ?? "low";
        const status = entry.status ?? "pending";
        return (
          <div key={i} style={styles.entry}>
            <span style={{ ...styles.dot, color: STATUS_ICON[status] ? "#666" : "#999" }}>
              {STATUS_ICON[status] ?? "○"}
            </span>
            <span style={{ ...styles.priority, color: PRIORITY_COLOR[priority] ?? "#999" }}>
              {t(`priority.${priority}` as const)}
            </span>
            <span style={styles.content}>{entry.content}</span>
          </div>
        );
      })}
    </div>
  );
}

export function UsageView({ usage }: { usage: UsageUpdate }): React.JSX.Element {
  const { t } = useTranslation();
  const pct = usage.size > 0 ? Math.min(100, Math.round((usage.used / usage.size) * 100)) : 0;
  return (
    <div style={styles.usage}>
      <span title={t("chat.contextTokens")}>
        {formatTokens(usage.used)} / {formatTokens(usage.size)} ({pct}%)
      </span>
      {usage.cost && (
        <span style={styles.cost}>
          {" · $"}
          {usage.cost.amount.toFixed(4)} {usage.cost.currency}
        </span>
      )}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function ModeView({
  modes,
  onSelectMode,
}: {
  modes: SessionModeState;
  /** If provided, mode chips become clickable and switch the mode. */
  onSelectMode?: (modeId: string) => void;
}): React.JSX.Element {
  return (
    <div style={styles.modes}>
      {modes.availableModes.map((mode) => {
        const active = mode.id === modes.currentModeId;
        return (
          <button
            key={mode.id}
            type="button"
            disabled={!onSelectMode || active}
            onClick={() => onSelectMode?.(mode.id)}
            style={{
              ...styles.modeChip,
              ...(active ? styles.modeActive : {}),
              ...(onSelectMode && !active ? styles.modeClickable : {}),
            }}
            title={mode.description}
          >
            {mode.name}
          </button>
        );
      })}
    </div>
  );
}

export function CommandsView({
  commands,
}: {
  commands: AvailableCommand[];
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div style={styles.card}>
      <div style={styles.title}>{t("commands.title")}</div>
      <div style={styles.commands}>
        {commands.map((cmd) => (
          <span key={cmd.name} style={styles.command} title={cmd.description}>
            /{cmd.name}
          </span>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    margin: "6px 12px",
    padding: "10px 12px",
    backgroundColor: "#fafafa",
    border: "1px solid #ececec",
    borderRadius: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#888",
    marginBottom: 8,
  },
  entry: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "3px 0",
    fontSize: 14,
  },
  dot: {
    width: 16,
    fontSize: 13,
  },
  priority: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    width: 48,
  },
  content: {
    flex: 1,
  },
  usage: {
    margin: "0 12px",
    padding: "6px 0",
    fontSize: 11,
    color: "#999",
    fontFamily: "ui-monospace, monospace",
  },
  cost: {
    color: "#666",
  },
  modes: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    padding: "0 12px",
  },
  modeChip: {
    fontSize: 12,
    padding: "3px 10px",
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    color: "#666",
    border: "1px solid #e0e0e0",
  },
  modeClickable: {
    cursor: "pointer",
  },
  modeActive: {
    backgroundColor: "#007AFF",
    color: "#fff",
    borderColor: "#007AFF",
  },
  commands: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  command: {
    fontSize: 12,
    fontFamily: "ui-monospace, monospace",
    padding: "3px 8px",
    borderRadius: 6,
    backgroundColor: "#eef4ff",
    color: "#0066cc",
  },
};
