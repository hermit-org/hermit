import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CopyButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** The text to copy to the clipboard. */
  value: string;
  /** Optional callback after a successful copy. */
  onCopied?: (value: string) => void;
  /** Accessible label; defaults to "Copy". */
  label?: string;
  /** Icon-only render size in pixels. */
  size?: number;
}

/**
 * Button that copies `value` to the clipboard, briefly showing a checkmark
 * on success.
 *
 * @example
 * <CopyButton value={message.content} />
 */
export function CopyButton({
  value,
  onCopied,
  label = "Copy",
  size = 16,
  className,
  disabled,
  ...props
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = React.useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      onCopied?.(value);
    } catch {
      // ignore clipboard failures
    }
  }, [value, onCopied]);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onClick={handleCopy}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...props}
    >
      {copied ? (
        <Check style={{ width: size, height: size }} className="text-success" />
      ) : (
        <Copy style={{ width: size, height: size }} />
      )}
    </button>
  );
}
