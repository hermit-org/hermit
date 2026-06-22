import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PlanEntry } from "@hermit-org/acp";

interface TodoViewProps {
  entries: PlanEntry[];
  /** Controlled collapsed state. Defaults to collapsed (show-current-only). */
  defaultCollapsed?: boolean;
}

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
};

/**
 * Collapsible todo/plan view, docked above the input.
 *
 * Collapsed (the default): shows only the *current* item — the first
 * in-progress entry, else the first pending entry, else a "done" state —
 * plus a progress count. Expanded: shows the full list with status icons.
 */
export function TodoView({
  entries,
  defaultCollapsed = true,
}: TodoViewProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!entries || entries.length === 0) return null;

  const completed = entries.filter((e) => e.status === "completed").length;
  const total = entries.length;

  // Current = first in_progress, else first pending, else last completed.
  const current =
    entries.find((e) => e.status === "in_progress") ??
    entries.find((e) => e.status !== "completed") ??
    entries[entries.length - 1];

  if (collapsed) {
    const allDone = completed === total;
    return (
      <button
        type="button"
        style={styles.collapsed}
        onClick={() => setCollapsed(false)}
        title={t("todoExpand")}
      >
        <span style={styles.todoLabel}>{t("todoTitle")}</span>
        <span style={styles.count}>
          {completed}/{total}
        </span>
        <span style={styles.currentText}>
          {allDone ? t("todoAllDone") : current.content}
        </span>
      </button>
    );
  }

  return (
    <div style={styles.expanded}>
      <div style={styles.header}>
        <span style={styles.todoLabel}>{t("todoTitle")}</span>
        <span style={styles.count}>
          {completed}/{total}
        </span>
        <button
          type="button"
          style={styles.toggle}
          onClick={() => setCollapsed(true)}
        >
          {t("todoCollapse")}
        </button>
      </div>
      {entries.map((entry, i) => {
        const status = entry.status ?? "pending";
        return (
          <div key={i} style={styles.entry}>
            <span style={styles.dot}>{STATUS_ICON[status] ?? "○"}</span>
            <span
              style={{
                ...styles.content,
                ...(status === "completed" ? styles.done : {}),
                ...(status === "in_progress" ? styles.active : {}),
              }}
            >
              {entry.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  collapsed: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "1px solid #e6e8eb",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 13,
    color: "#333",
  },
  expanded: {
    border: "1px solid #e6e8eb",
    borderRadius: 8,
    padding: "8px 10px",
    backgroundColor: "#fafbfc",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  todoLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#888",
  },
  count: {
    fontSize: 11,
    fontFamily: "ui-monospace, monospace",
    color: "#999",
  },
  currentText: {
    flex: 1,
    fontSize: 13,
    color: "#1f2328",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  toggle: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "#007AFF",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
  entry: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "2px 0",
    fontSize: 13,
  },
  dot: {
    width: 14,
    fontSize: 12,
    color: "#999",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    color: "#333",
  },
  done: {
    color: "#999",
    textDecoration: "line-through",
  },
  active: {
    fontWeight: 600,
    color: "#007AFF",
  },
};
