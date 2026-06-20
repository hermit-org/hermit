import * as React from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScrollToBottomButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional unread-count badge. */
  unreadCount?: number;
  /** Accessible label; defaults to "Scroll to bottom". */
  label?: string;
}

/**
 * Floating action button that scrolls a chat / log view to the bottom.
 *
 * @example
 * <ScrollToBottomButton unreadCount={3} onClick={scrollToEnd} />
 */
export const ScrollToBottomButton = React.forwardRef<
  HTMLButtonElement,
  ScrollToBottomButtonProps
>(
  (
    { unreadCount, label = "Scroll to bottom", className, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label={unreadCount ? `${label} (${unreadCount} new)` : label}
        title={label}
        {...props}
      >
        <ArrowDown className="h-4 w-4" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
    );
  },
);
ScrollToBottomButton.displayName = "ScrollToBottomButton";
