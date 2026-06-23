import * as React from "react";

export interface StreamingTextProps {
  /** The full (and growing) text to render. */
  text: string;
  /** Whether the message is still streaming; enables the caret. */
  streaming?: boolean;
  /** Render speed in characters per tick. */
  charsPerTick?: number;
  /** Tick interval in ms. */
  intervalMs?: number;
  /** Render the plain text (no markdown). */
  className?: string;
}

/**
 * Renders streaming text with a typewriter effect and a blinking caret while
 * `streaming` is true. Re-renders grow the visible prefix toward the latest
 * `text`, and on completion snaps to the full value.
 */
export function StreamingText({
  text,
  streaming,
  charsPerTick = 4,
  intervalMs = 16,
  className,
}: StreamingTextProps): React.JSX.Element {
  const [shown, setShown] = React.useState(() => text.length);
  // Mirror `shown` into a ref so the interval reads the latest value instead
  // of the value captured at effect-creation time.
  const shownRef = React.useRef(shown);
  shownRef.current = shown;

  React.useEffect(() => {
    if (!streaming) {
      setShown(text.length);
      return;
    }
    if (text.length <= shownRef.current) {
      setShown(text.length);
      return;
    }
    const id = setInterval(() => {
      const current = shownRef.current;
      const next = current + charsPerTick;
      if (next >= text.length) {
        clearInterval(id);
        setShown(text.length);
        return;
      }
      setShown(next);
    }, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, streaming, charsPerTick, intervalMs]);

  const visible = text.slice(0, shown);
  const pending = streaming && shown < text.length;

  return (
    <span className={className}>
      {visible}
      {pending ? (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret-blink bg-foreground align-middle"
        />
      ) : null}
    </span>
  );
}
