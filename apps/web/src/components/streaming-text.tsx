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

  // Track the latest text length via a ref so the interval callback always
  // reads the current value without re-creating the interval on every chunk.
  const textLenRef = React.useRef(text.length);
  textLenRef.current = text.length;

  // Track whether streaming just ended, so we can flush the remaining tail
  // at an accelerated rate.
  const wasStreamingRef = React.useRef(streaming ?? false);
  const streamingRef = React.useRef(streaming ?? false);
  streamingRef.current = streaming ?? false;

  React.useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = streaming ?? false;

    if (!streaming) {
      // Message finished — flush remaining text at accelerated rate.
      if (textLenRef.current > shownRef.current) {
        const fastChars = Math.max(charsPerTick * fastFinishMultiplier, 8);
        const fastInterval = Math.min(intervalMs, 8);
        const id = setInterval(() => {
          const target = textLenRef.current;
          const next = shownRef.current + fastChars;
          if (next >= target) {
            clearInterval(id);
            setShown(target);
            return;
          }
          setShown(next);
        }, fastInterval);
        return () => clearInterval(id);
      }
      // Fully shown, nothing to do.
      setShown(textLenRef.current);
      return;
    }

    // Still streaming: if the text shrank (e.g. a new message replaced the
    // old one), snap to the new length.
    if (textLenRef.current <= shownRef.current) {
      setShown(textLenRef.current);
      return;
    }

    // Use a single stable interval that chases `textLenRef` via ref. This
    // avoids clearing/re-creating the interval on every streaming chunk,
    // which previously caused ticks to never fire when text arrived at a
    // rate close to or faster than `intervalMs`.
    const id = setInterval(() => {
      const target = textLenRef.current;
      const next = shownRef.current + charsPerTick;
      if (next >= target) {
        // Caught up — snap to target. The interval stays alive so it can
        // resume chasing when more text arrives.
        setShown(target);
        return;
      }
      setShown(next);
    }, intervalMs);
    return () => clearInterval(id);
    // Intentionally only depend on `streaming` and config params — NOT `text`.
    // The interval reads the latest text length via `textLenRef` so it never
    // goes stale, and avoiding `text` in the deps prevents the interval from
    // being torn down and rebuilt on every streaming chunk.
  }, [streaming, charsPerTick, intervalMs, fastFinishMultiplier]);

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
