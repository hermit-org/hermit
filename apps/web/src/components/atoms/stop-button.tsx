import * as React from "react";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StopButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label; defaults to "Stop generating". */
  label?: string;
}

/**
 * Circular destructive button used to cancel an in-flight ACP turn
 * (`session/cancel`).
 *
 * @example
 * <StopButton onClick={onCancel} />
 */
export function StopButton({
  label = "Stop generating",
  className,
  ...props
}: StopButtonProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="destructive"
      size="icon"
      className={cn("rounded-full", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Square className="h-3.5 w-3.5 fill-current" />
    </Button>
  );
}
