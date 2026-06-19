import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Check, X } from "lucide-react";

interface MultiQuestionInputProps {
  /** Disabled while the agent is processing a turn. */
  disabled?: boolean;
  /** Number of questions currently queued/processing (shown as a badge). */
  queued?: number;
  /** Called with the non-empty questions when the user confirms. */
  onConfirm: (questions: string[]) => void;
}

/**
 * Composes multiple questions stacked vertically (1. 2. 3. …), each its own
 * input. The user can add more questions, then "Confirm" to enqueue them all.
 *
 * On confirm the inputs are cleared and the questions are handed off to the
 * parent, which sends them as sequential prompt turns. All questions and
 * their answers remain visible in the chat history.
 */
export function MultiQuestionInput({
  disabled = false,
  queued = 0,
  onConfirm,
}: MultiQuestionInputProps): React.JSX.Element {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<string[]>([""]);

  const update = (index: number, value: string): void => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const remove = (index: number): void => {
    setQuestions((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  const add = (): void => {
    setQuestions((prev) => [...prev, ""]);
  };

  const validQuestions = questions.map((q) => q.trim()).filter(Boolean);

  const handleConfirm = (): void => {
    if (validQuestions.length === 0 || disabled) return;
    onConfirm(validQuestions);
    setQuestions([""]);
  };

  return (
    <div style={styles.container}>
      {questions.map((q, i) => (
        <div key={i} style={styles.row}>
          <span style={styles.number}>{i + 1}.</span>
          <input
            style={styles.input}
            placeholder={t("questionPlaceholder")}
            value={q}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && i === questions.length - 1) {
                e.preventDefault();
                add();
              }
            }}
            disabled={disabled}
          />
          {questions.length > 1 && (
            <button
              type="button"
              style={styles.removeBtn}
              onClick={() => remove(i)}
              aria-label="remove"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      <div style={styles.toolbar}>
        <button
          type="button"
          style={styles.addBtn}
          onClick={add}
          disabled={disabled}
        >
          <Plus size={14} />
          {t("addQuestion")}
        </button>
        {queued > 0 && <span style={styles.queued}>{queued} {t("queued")}</span>}
        <button
          type="button"
          style={{
            ...styles.confirmBtn,
            ...(validQuestions.length === 0 || disabled
              ? styles.confirmDisabled
              : {}),
          }}
          onClick={handleConfirm}
          disabled={validQuestions.length === 0 || disabled}
        >
          <Check size={14} />
          {t("confirmQuestions")}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  number: {
    fontSize: 13,
    fontWeight: 600,
    color: "#007AFF",
    width: 20,
    textAlign: "right",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    border: "1px solid #d1d1d1",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#999",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "1px dashed #c1c1c1",
    color: "#666",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  queued: {
    fontSize: 11,
    color: "#f5a623",
    fontFamily: "ui-monospace, monospace",
  },
  confirmBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmDisabled: {
    backgroundColor: "#b3d7ff",
    cursor: "not-allowed",
  },
};
