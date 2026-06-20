import * as React from "react";
import { ShieldAlert, Check, X, ChevronDown, ChevronUp } from "lucide-react";
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
  /** Resolve a pending request with the chosen option id. */
  onResolve: (request: PendingPermission, optionId: string) => void;
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
 * Renders agent-initiated permission requests
 * (`session/request_permission`) inline above the message composer, plus a
 * collapsible history of previously-answered questions. Mirrors the legacy
 * `ToolQuestionsView` UX (non-modal).
 */
export function ToolQuestionsPanel({
  requests,
  history,
  onResolve,
  onCancel,
  className,
}: ToolQuestionsPanelProps): React.JSX.Element | null {
  const [showHistory, setShowHistory] = React.useState(false);

  if (requests.length === 0 && (!history || history.length === 0)) return null;

  return (
    <div className={cn("flex flex-col gap-2 px-3 pt-2", className)}>
      {requests.map((req, i) => {
        const tc = req.toolCall;
        const title = tc.title ?? req.id;
        const kind = tc.kind ?? "tool";
        return (
          <div
            key={req.id}
            className="rounded-lg border border-warning/40 bg-card p-2.5 text-sm shadow-sm"
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-xs font-bold text-primary">{i + 1}.</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {kind}
              </span>
              <span className="flex-1 truncate font-medium">{title}</span>
              {onCancel ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onCancel(req)}
                  aria-label="dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
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
                  onClick={() => onResolve(req, opt.optionId)}
                >
                  <Check className="h-3 w-3" />
                  {opt.name}
                </button>
              ))}
            </div>
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
            Answered ({history.length})
          </button>
          {showHistory
            ? history.map((h) => (
                <div
                  key={`${h.id}-${h.at}`}
                  className="border-b border-border/50 py-1 text-[11px]"
                >
                  <div className="font-semibold text-muted-foreground">
                    Q: {h.question}
                  </div>
                  <div className="text-green-600 dark:text-green-400">
                    A: {h.answer}
                  </div>
                  {h.note ? (
                    <div className="italic text-muted-foreground">
                      ✎ {h.note}
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
