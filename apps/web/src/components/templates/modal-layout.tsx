import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ModalAction {
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
}

export interface ModalLayoutProps {
  /** Controlled open state. */
  open?: boolean;
  /** Default open state (uncontrolled). */
  defaultOpen?: boolean;
  /** Control open state. */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title. */
  title?: React.ReactNode;
  /** Dialog description. */
  description?: React.ReactNode;
  /** Modal body. */
  children?: React.ReactNode;
  /** Footer action buttons. */
  actions?: ModalAction[];
  /** Max width class. Defaults to "max-w-lg". */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalLayoutProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

/**
 * Reusable modal layout template: overlay + content card with header, body,
 * and a configurable footer action group.
 *
 * @example
 * <ModalLayout open={open} title="Fork session" actions={[{ label: "Fork" }, { label: "Cancel", variant: "outline" }]} />
 */
export function ModalLayout({
  open,
  defaultOpen,
  onOpenChange,
  title,
  description,
  children,
  actions = [],
  size = "lg",
  className,
}: ModalLayoutProps): React.JSX.Element {
  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SIZE_CLASS[size], className)}>
        {(title || description) && (
          <DialogHeader>
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
        )}
        {children}
        {actions.length > 0 ? (
          <DialogFooter>
            {actions.map((a, i) => (
              <Button
                key={i}
                type="button"
                variant={a.variant ?? "default"}
                disabled={a.disabled}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
