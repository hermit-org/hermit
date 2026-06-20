import * as React from "react";
import { ShieldAlert, Check, X, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PendingPermission, PermissionOption } from "@/components/domain";

export interface PermissionRequestDialogProps {
  /** The pending permission request to display. */
  request: PendingPermission;
  /** Fired with the chosen option, or "cancelled". */
  onResolve: (optionId: string | "cancelled") => void;
  /** Disable all actions (e.g. while submitting). */
  busy?: boolean;
  className?: string;
}

function isAllow(opt: PermissionOption): boolean {
  return opt.kind === "allow_once" || opt.kind === "allow_always";
}

function variantFor(opt: PermissionOption) {
  if (opt.kind === "allow_always") return "success" as const;
  if (opt.kind === "allow_once") return "default" as const;
  if (opt.kind === "reject_always") return "destructive" as const;
  if (opt.kind === "reject_once") return "outline" as const;
  return "secondary" as const;
}

/**
 * Permission request card (Approve / Reject / Cancel) for ACP
 * `session/request_permission`.
 *
 * @example
 * <PermissionRequestDialog request={req} onResolve={handle} />
 */
export function PermissionRequestDialog({
  request,
  onResolve,
  busy,
  className,
}: PermissionRequestDialogProps): React.JSX.Element {
  const tc = request.toolCall;
  const allows = request.options.filter(isAllow);
  const rejects = request.options.filter((o) => !isAllow(o));

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-lg border border-warning/40 bg-card p-4 shadow-lg",
        className,
      )}
      role="alertdialog"
      aria-labelledby="perm-title"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="perm-title" className="text-sm font-semibold">
            Permission requested
          </h3>
          <p className="text-xs text-muted-foreground">
            {tc.title ?? tc.toolCallId}
            {tc.kind ? (
              <>
                {" · "}
                <span className="font-mono">{tc.kind}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {tc.kind ? (
        <div className="mt-3">
          <Badge variant="outline" className="uppercase">
            {tc.kind}
          </Badge>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {allows.map((opt) => (
          <Button
            key={opt.optionId}
            variant={variantFor(opt)}
            size="sm"
            disabled={busy}
            onClick={() => onResolve(opt.optionId)}
          >
            <Check className="h-4 w-4" />
            {opt.name}
          </Button>
        ))}
        {rejects.map((opt) => (
          <Button
            key={opt.optionId}
            variant={variantFor(opt)}
            size="sm"
            disabled={busy}
            onClick={() => onResolve(opt.optionId)}
          >
            <X className="h-4 w-4" />
            {opt.name}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onResolve("cancelled")}
        >
          <Ban className="h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
