import * as React from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export interface StreamingTextProps {
  /** The full (and growing) text to render. */
  text: string;
  /** Whether the message is still streaming; enables the caret. */
  streaming?: boolean;
  /** Render as markdown instead of plain text. */
  markdown?: boolean;
  /** Render speed in characters per tick. */
  charsPerTick?: number;
  /** Tick interval in ms. */
  intervalMs?: number;
  /** Fast-finish speed multiplier applied when streaming ends. */
  fastFinishMultiplier?: number;
  /** Additional className. */
  className?: string;
}

/**
 * Typewriter-style streaming text renderer.
 *
 * Progressively reveals a growing prefix of `text`. When `streaming` turns
 * false, switches to a faster reveal rate so the tail is flushed quickly.
 *
 * Supports both plain-text (default) and markdown rendering. For markdown,
 * the visible prefix is fed to `MarkdownRenderer`; partial / unclosed syntax
 * is gracefully handled by the markdown parser.
 */
export function StreamingText({
  text,
  streaming,
  markdown = false,
  charsPerTick = 4,
  intervalMs = 16,
  fastFinishMultiplier = 4,
  className,
}: StreamingTextProps): React.JSX.Element {
  // Start fully shown so non-streaming / historical messages render instantly.
  const [shown, setShown] = React.useState(() => text.length);
  const shownRef = React.useRef(shown);
  shownRef.current = shown;

  // Track whether streaming just ended, so we can flush the remaining tail
  // at an accelerated rate.
  const wasStreamingRef = React.useRef(streaming ?? false);

  React.useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = streaming ?? false;

    if (!streaming) {
      // Message finished — if there's still buffered text, accelerate through it.
      if (text.length > shownRef.current) {
        const fastChars = Math.max(charsPerTick * fastFinishMultiplier, 8);
        const id = setInterval(() => {
          const next = shownRef.current + fastChars;
          if (next >= text.length) {
            clearInterval(id);
            setShown(text.length);
            return;
          }
          setShown(next);
        }, Math.min(intervalMs, 8));
        return () => clearInterval(id);
      }
      // Fully shown, nothing to do.
      setShown(text.length);
      return;
    }

    // Still streaming: if the text shrank (e.g. a new message replaced the
    // old one), snap to the new length.
    if (text.length <= shownRef.current) {
      setShown(text.length);
      return;
    }

    const id = setInterval(() => {
      const next = shownRef.current + charsPerTick;
      if (next >= text.length) {
        // Don't clearInterval here — more text may arrive and the effect will
        // re-run when `text` changes, creating a fresh interval.
        setShown(text.length);
        return;
      }
      setShown(next);
    }, intervalMs);
    return () => clearInterval(id);
  }, [text, streaming, charsPerTick, intervalMs, fastFinishMultiplier]);

  const visible = text.slice(0, shown);
  const pending = (streaming || text.length > shown) && shown < text.length;

  if (markdown) {
    return (
      <span className={className}>
        <MarkdownRenderer content={visible} />
        {pending ? (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret-blink bg-foreground align-middle"
          />
        ) : null}
      </span>
    );
  }

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
