import * as React from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SendButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Disable the button (e.g. empty input or busy turn). */
  disabled?: boolean;
  /** Accessible label; defaults to "Send". */
  label?: string;
}

/**
 * Primary send action for the message composer.
 *
 * @example
 * <SendButton disabled={!canSend} onClick={onSend} />
 */
export function SendButton({
  disabled,
  label = "Send",
  className,
  ...props
}: SendButtonProps): React.JSX.Element {
  return (
    <Button
      type="submit"
      size="icon"
      className={cn("rounded-full", className)}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...props}
    >
      <SendHorizontal className="h-4 w-4" />
    </Button>
  );
}
