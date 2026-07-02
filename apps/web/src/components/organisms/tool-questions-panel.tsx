import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PendingPermission,
  AnsweredPermissionView,
} from "@/components/domain";

export interface ToolQuestionsPanelProps {
  /** Pending permission requests awaiting a decision. */
  requests: PendingPermission[];
  /** Previously-answered questions, newest first. */
  history?: AnsweredPermissionView[];
  /** Resolve a pending request with the chosen option id (and optional note). */
  onResolve: (
    request: PendingPermission,
    optionId: string,
    note?: string,
  ) => void;
  /** Cancel/dismiss a pending request. */
  onCancel?: (request: PendingPermission) => void;
  className?: string;
}

function optionClass(kind?: string): string {
  switch (kind) {
    case "allow_once":
    case "allow_always":
      return "bg-green-600 text-white hover:bg-green-700";
    case "reject_once":
    case "reject_always":
      return "bg-red-600 text-white hover:bg-red-700";
    default:
      return "bg-primary text-primary-foreground hover:bg-primary/90";
  }
}

/**
 * Best-effort extraction of rich question metadata from an AskUserQuestion-
 * style tool call's `rawInput`.
 *
 * The ACP `session/request_permission` carries a single `toolCall` plus flat
 * `options` array. Some agents (e.g. Kimi Code) embed the full multi-question
 * structure in `toolCall.rawInput` as JSON. This helper extracts:
 *   - `description` — contextual text to display below the title
 *   - `header` — a category tag shown as a badge
 *
 * Returns `null` when no useful metadata is found.
 */
function extractQuestionMeta(
  rawInput: unknown,
): { description?: string; header?: string } | null {
  if (!rawInput || typeof rawInput !== "object") return null;
  const obj = rawInput as Record<string, unknown>;
  const description =
    typeof obj.description === "string" ? obj.description : undefined;
  const header = typeof obj.header === "string" ? obj.header : undefined;
  if (!description && !header) return null;
  return { description, header };
}

/**
 * Renders agent-initiated permission requests
 * (`session/request_permission`) inline above the message composer, plus a
 * collapsible history of previously-answered questions.
 *
 * Each pending request is shown as a card with:
 *   - A title (from `toolCall.title`) and optional description/header extracted
 *     from `toolCall.rawInput`
 *   - Option buttons (from the flat `options` array)
 *   - An optional supplementary-note text input for the user to add context
 *
 * The note is forwarded to `onResolve` and ultimately back to the agent via
 * the `PermissionOutcome.note` field.
 */
export function ToolQuestionsPanel({
  requests,
  history,
  onResolve,
  onCancel,
  className,
}: ToolQuestionsPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [showHistory, setShowHistory] = React.useState(false);
  // Per-request note drafts, keyed by request id.
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  if (requests.length === 0 && (!history || history.length === 0)) return null;

  return (
    <div className={cn("flex flex-col gap-2 px-3 pt-2", className)}>
      {requests.map((req, i) => {
        const tc = req.toolCall;
        const title = tc.title ?? req.id;
        const kind = tc.kind ?? "tool";
        const meta = extractQuestionMeta(tc.rawInput);
        const noteValue = notes[req.id] ?? "";

        const handleResolve = (optionId: string) => {
          const note = noteValue.trim() || undefined;
          // Clear the draft for this request.
          setNotes((prev) => {
            if (!note) return prev;
            const next = { ...prev };
            delete next[req.id];
            return next;
          });
          onResolve(req, optionId, note);
        };

        return (
          <div
            key={req.id}
            className="rounded-lg border border-warning/40 bg-card p-2.5 text-sm shadow-sm"
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-xs font-bold text-primary">{i + 1}.</span>
              {meta?.header ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {meta.header}
                </span>
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {kind}
                </span>
              )}
              <span className="flex-1 truncate font-medium">{title}</span>
              {onCancel ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onCancel(req)}
                  aria-label={t("common.dismiss")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {meta?.description ? (
              <p className="mb-1.5 text-xs text-muted-foreground">
                {meta.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {req.options.map((opt) => (
                <button
                  key={opt.optionId}
                  type="button"
                  title={opt.name}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
                    optionClass(opt.kind),
                  )}
                  onClick={() => handleResolve(opt.optionId)}
                >
                  <Check className="h-3 w-3" />
                  {opt.name}
                </button>
              ))}
            </div>
            {/* Supplementary note input — lets the user add context that is
                forwarded back to the agent alongside the chosen option. */}
            <input
              type="text"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("permission.notePlaceholder")}
              value={noteValue}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
              }
              onKeyDown={(e) => {
                // Submit on Enter using the first option (most common UX for
                // a single-option question with a note).
                if (e.key === "Enter" && req.options.length > 0) {
                  e.preventDefault();
                  handleResolve(req.options[0].optionId);
                }
              }}
            />
          </div>
        );
      })}

      {history && history.length > 0 ? (
        <div className="border-t border-dashed border-border pt-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowHistory((s) => !s)}
          >
            {showHistory ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {t("chat.answeredHistory", { count: history.length })}
          </button>
          {showHistory
            ? history.map((h) => (
                <div
                  key={`${h.id}-${h.at}`}
                  className="border-b border-border/50 py-1 text-[11px]"
                >
                  <div className="font-semibold text-muted-foreground">
                    {t("permission.qPrefix")} {h.question}
                  </div>
                  <div className="text-green-600 dark:text-green-400">
                    {t("permission.aPrefix")} {h.answer}
                  </div>
                  {h.note ? (
                    <div className="italic text-muted-foreground">
                      {t("permission.note")}: {h.note}
                    </div>
                  ) : null}
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
