import { useEffect, useRef, useState } from "react";

/**
 * Throttle a fast-changing value so downstream consumers (e.g. a Markdown
 * renderer) do not re-render on every single update.
 *
 * The latest value is always flushed when the source stops changing for the
 * specified wait duration.
 */
export function useThrottle<T>(value: T, waitMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdateRef = useRef(Date.now());
  const pendingRef = useRef<T | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    const flush = () => {
      if (pendingRef.current !== undefined) {
        setThrottled(pendingRef.current);
        pendingRef.current = undefined;
      } else {
        setThrottled(value);
      }
      lastUpdateRef.current = Date.now();
    };

    if (elapsed >= waitMs) {
      // Enough time has passed; update immediately.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flush();
      return;
    }

    // Otherwise queue the latest value and flush after the remaining wait.
    pendingRef.current = value;
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flush();
      }, waitMs - elapsed);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, waitMs]);

  return throttled;
}
