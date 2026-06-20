import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Pixel size of the spinner. */
  size?: number;
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

/**
 * Animated loading spinner.
 *
 * @example
 * <Spinner size={20} />
 */
export function Spinner({
  size = 16,
  label: labelProp,
  className,
  ...props
}: SpinnerProps): React.JSX.Element {
  const { t } = useTranslation();
  const label = labelProp ?? t("common.loading");
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Loader2
        className="animate-spin text-muted-foreground"
        style={{ width: size, height: size }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
