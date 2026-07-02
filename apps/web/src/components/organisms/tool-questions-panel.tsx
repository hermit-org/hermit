import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  SkipForward,
} from "lucide-react";
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
 * Each pending request is shown as a conversational question card — no
 * tool-call artifacts (kind labels, raw JSON) are surfaced. Answered items
 * render as user-style reply bubbles so they feel part of the conversation.
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
            className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm"
          >
            {/* Header: question number badge + optional category tag */}
            <div className="mb-1 flex items-center gap-1.5">
              {meta?.header ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {meta.header}
                </span>
              ) : null}
              {requests.length > 1 ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("permission.questionBadge", { n: i + 1 })}
                </span>
              ) : null}
              {onCancel ? (
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  onClick={() => onCancel(req)}
                  aria-label={t("common.dismiss")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {/* Main question text */}
            <div className="mb-1.5 flex items-start gap-1.5">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-sm font-medium leading-snug">{title}</span>
            </div>
            {meta?.description ? (
              <p className="mb-2 pl-5 text-xs text-muted-foreground">
                {meta.description}
              </p>
            ) : null}
            {/* Option cards */}
            <div className="flex flex-wrap gap-1.5 pl-5">
              {req.options.map((opt) => (
                <button
                  key={opt.optionId}
                  type="button"
                  title={opt.name}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    optionClass(opt.kind),
                  )}
                  onClick={() => handleResolve(opt.optionId)}
                >
                  {opt.name}
                </button>
              ))}
            </div>
            {/* Supplementary note input */}
            <input
              type="text"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("permission.notePlaceholder")}
              value={noteValue}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && req.options.length > 0) {
                  e.preventDefault();
                  handleResolve(req.options[0].optionId);
                }
              }}
            />
          </div>
        );
      })}

      {/* Answered history — rendered as user-style reply bubbles */}
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
                  className="mt-1.5 flex flex-col items-end gap-0.5"
                >
                  {/* Question — muted, right-aligned prefix */}
                  <span className="max-w-[85%] text-[11px] text-muted-foreground">
                    {h.question}
                  </span>
                  {/* Answer / skip — user-style bubble */}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-1.5 text-xs shadow-sm ring-1 ring-inset",
                      h.cancelled
                        ? "bg-muted text-muted-foreground ring-border"
                        : "bg-primary text-primary-foreground ring-primary",
                    )}
                  >
                    {h.cancelled ? (
                      <span className="inline-flex items-center gap-1">
                        <SkipForward className="h-3 w-3" />
                        {t("permission.skipped")}
                      </span>
                    ) : (
                      <span className="font-medium">{h.answer}</span>
                    )}
                    {h.note ? (
                      <div
                        className={cn(
                          "mt-0.5 text-[10px]",
                          h.cancelled
                            ? "italic text-muted-foreground"
                            : "italic text-primary-foreground/80",
                        )}
                      >
                        {h.note}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
