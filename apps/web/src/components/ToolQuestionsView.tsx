import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePermissionStore, type PendingPermission } from "../stores";
import { Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

interface Selection {
  optionId?: string;
  note: string;
}

/**
 * Tool questions view — renders agent-initiated prompts
 * (`session/request_permission`) docked above the input.
 *
 * - Single pending request → one question.
 * - Multiple pending requests → numbered 1. 2. 3. … vertically.
 * - Each question shows its options (pick one) and an "other" text input the
 *   user can fill in as a note.
 * - One "Confirm" submits all answers at once; after confirming, the answered
 *   questions move into a collapsible history so the user can review every
 *   question and answer.
 */
export function ToolQuestionsView(): React.JSX.Element | null {
  const { t } = useTranslation();
  const pending = usePermissionStore((s) => s.pending);
  const history = usePermissionStore((s) => s.history);
  const respondAll = usePermissionStore((s) => s.respondAll);
  const cancel = usePermissionStore((s) => s.cancel);
  const clearHistory = usePermissionStore((s) => s.clearHistory);

  // Per-question selection state: optionId + optional note.
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [showHistory, setShowHistory] = useState(false);

  // Reset selections when the set of pending questions changes.
  useEffect(() => {
    setSelections((prev) => {
      const next: Record<string, Selection> = {};
      for (const p of pending) {
        const existing = prev[p.id];
        next[p.id] = existing ?? { note: "" };
      }
      return next;
    });
  }, [pending]);

  if (pending.length === 0 && history.length === 0) return null;

  const allAnswered = pending.every((p) => selections[p.id]?.optionId);

  const setOption = (id: string, optionId: string): void => {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], optionId },
    }));
  };

  const setNote = (id: string, note: string): void => {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], note },
    }));
  };

  const handleConfirm = (): void => {
    const responses: { id: string; optionId: string; note?: string }[] = [];
    for (const p of pending) {
      const sel = selections[p.id];
      if (!sel?.optionId) continue;
      const note = sel.note.trim();
      responses.push({ id: p.id, optionId: sel.optionId, note: note || undefined });
    }
    if (responses.length === 0) return;
    respondAll(responses);
  };

  return (
    <div style={styles.container}>
      {pending.map((p, i) => (
        <QuestionRow
          key={p.id}
          index={i + 1}
          entry={p}
          selection={selections[p.id] ?? { note: "" }}
          onPickOption={(oid) => setOption(p.id, oid)}
          onNote={(note) => setNote(p.id, note)}
          onDismiss={() => cancel(p.id)}
        />
      ))}

      {pending.length > 0 && (
        <div style={styles.actions}>
          <button
            type="button"
            style={{
              ...styles.confirmBtn,
              ...(!allAnswered ? styles.confirmDisabled : {}),
            }}
            onClick={handleConfirm}
            disabled={!allAnswered}
          >
            <Check size={14} />
            {t("chat.confirmQuestions")}
            {pending.length > 1 ? ` (${pending.length})` : ""}
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div style={styles.historySection}>
          <button
            type="button"
            style={styles.historyToggle}
            onClick={() => setShowHistory((s) => !s)}
          >
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {t("chat.answeredHistory")} ({history.length})
          </button>
          {showHistory && (
            <>
              {history.map((h, i) => (
                <div key={`${h.toolCallId}-${i}`} style={styles.historyItem}>
                  <div style={styles.historyQ}>Q: {h.question}</div>
                  <div style={styles.historyA}>A: {h.answer}</div>
                  {h.note && <div style={styles.historyNote}>✎ {h.note}</div>}
                </div>
              ))}
              <button
                type="button"
                style={styles.clearBtn}
                onClick={clearHistory}
              >
                <Trash2 size={12} />
                {t("chat.clearHistory")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionRow({
  index,
  entry,
  selection,
  onPickOption,
  onNote,
  onDismiss,
}: {
  index: number;
  entry: PendingPermission;
  selection: Selection;
  onPickOption: (optionId: string) => void;
  onNote: (note: string) => void;
  onDismiss: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const tc = entry.toolCall;
  const title = tc.title ?? entry.id;
  const kind = tc.kind ?? "tool";

  return (
    <div style={styles.question}>
      <div style={styles.questionHead}>
        <span style={styles.number}>{index}.</span>
        <span style={styles.kind}>{kind}</span>
        <span style={styles.title}>{title}</span>
        <button
          type="button"
          style={styles.dismiss}
          onClick={onDismiss}
          aria-label="dismiss"
        >
          ×
        </button>
      </div>

      <div style={styles.options}>
        {entry.options.map((opt) => {
          const active = selection.optionId === opt.optionId;
          return (
            <button
              key={opt.optionId}
              type="button"
              style={{
                ...styles.option,
                ...(active ? optionStyleForKind(opt.kind, true) : optionStyleForKind(opt.kind, false)),
              }}
              onClick={() => onPickOption(opt.optionId)}
              title={opt.name}
            >
              {active ? "✓ " : ""}
              {opt.name}
            </button>
          );
        })}
      </div>

      <input
        style={styles.noteInput}
        placeholder={t("chat.otherInput")}
        value={selection.note}
        onChange={(e) => onNote(e.target.value)}
      />
    </div>
  );
}

function optionStyleForKind(
  kind: string | undefined,
  active: boolean,
): React.CSSProperties {
  if (!active) {
    return { backgroundColor: "#fff", color: "#333", border: "1px solid #d1d1d1" };
  }
  switch (kind) {
    case "allow_once":
      return { backgroundColor: "#34a853", color: "#fff", border: "1px solid #34a853" };
    case "allow_always":
      return { backgroundColor: "#0b8043", color: "#fff", border: "1px solid #0b8043" };
    case "reject_once":
      return { backgroundColor: "#ea4335", color: "#fff", border: "1px solid #ea4335" };
    case "reject_always":
      return { backgroundColor: "#b3261e", color: "#fff", border: "1px solid #b3261e" };
    default:
      return { backgroundColor: "#007AFF", color: "#fff", border: "1px solid #007AFF" };
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  question: {
    border: "1px solid #e6e8eb",
    borderRadius: 10,
    padding: "8px 10px",
    backgroundColor: "#fff",
  },
  questionHead: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  number: {
    fontSize: 13,
    fontWeight: 700,
    color: "#007AFF",
    flexShrink: 0,
  },
  kind: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#666",
    backgroundColor: "#eee",
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 600,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: "#1f2328",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dismiss: {
    background: "none",
    border: "none",
    color: "#999",
    fontSize: 18,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  options: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  option: {
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  noteInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #e6e8eb",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 13,
    outline: "none",
    color: "#333",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  confirmBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmDisabled: {
    backgroundColor: "#b3d7ff",
    cursor: "not-allowed",
  },
  historySection: {
    borderTop: "1px dashed #e6e8eb",
    paddingTop: 6,
    marginTop: 2,
  },
  historyToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "#666",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
  historyItem: {
    fontSize: 12,
    padding: "4px 0",
    color: "#555",
    borderBottom: "1px solid #f0f0f0",
  },
  historyQ: {
    fontWeight: 600,
    color: "#333",
  },
  historyA: {
    color: "#0b8043",
  },
  historyNote: {
    color: "#888",
    fontStyle: "italic",
  },
  clearBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "#ea4335",
    fontSize: 11,
    cursor: "pointer",
    padding: "4px 0",
    marginTop: 4,
  },
};
