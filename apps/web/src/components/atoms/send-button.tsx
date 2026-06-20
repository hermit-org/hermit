import * as React from "react";
import { useTranslation } from "react-i18next";
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
  label: labelProp,
  className,
  ...props
}: SendButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const label = labelProp ?? t("common.send");
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
