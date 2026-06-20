import * as React from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { PermissionRequestDialog } from "@/components/molecules";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PendingPermission } from "@/components/domain";

export interface PermissionModalProps {
  /** Queue of pending permission requests. */
  requests: PendingPermission[];
  /** Whether the modal is controlled-open. If omitted, opens when requests exist. */
  open?: boolean;
  /** Control open state. */
  onOpenChange?: (open: boolean) => void;
  /** Resolve the currently-displayed request. */
  onResolve: (
    request: PendingPermission,
    outcome: string | "cancelled",
  ) => void;
  className?: string;
}

/**
 * Permission modal that queues multiple pending `session/request_permission`
 * requests and lets the user step through them, resolving each.
 *
 * @example
 * <PermissionModal requests={queue} onResolve={resolve} />
 */
export function PermissionModal({
  requests,
  open,
  onOpenChange,
  onResolve,
  className,
}: PermissionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (index > requests.length - 1) {
      setIndex(Math.max(0, requests.length - 1));
    }
  }, [requests.length, index]);

  const isOpen = open ?? requests.length > 0;
  const current = requests[index] ?? requests[0];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        // Prevent closing while requests are pending (must resolve each).
        if (!o && requests.length > 0) return;
        onOpenChange?.(o);
      }}
    >
      <DialogContent
        hideClose={requests.length > 0}
        className={cn("max-w-md gap-0 p-0", className)}
      >
        <DialogTitle className="sr-only">{t("permission.requested")}</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <ShieldAlert className="h-4 w-4 text-warning" />
          <span className="text-sm font-semibold">{t("permission.required")}</span>
          {requests.length > 1 ? (
            <Badge variant="secondary" className="ml-auto gap-1">
              {index + 1} / {requests.length}
            </Badge>
          ) : null}
        </div>
        {current ? (
          <div className="p-4">
            <PermissionRequestDialog
              request={current}
              onResolve={(outcome) => onResolve(current, outcome)}
            />
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            {t("permission.noPending")}
          </div>
        )}
        {requests.length > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("permission.previous")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={index >= requests.length - 1}
              onClick={() =>
                setIndex((i) => Math.min(requests.length - 1, i + 1))
              }
            >
              {t("permission.next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
