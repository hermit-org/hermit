import { useCallback, useRef } from "react";
import { useLoadingStore } from "../stores/loadingStore";

/**
 * Hook to control the global loading overlay.
 *
 * Usage:
 *   const { showLoading, hideLoading, withLoading } = useLoading();
 *
 *   // Manual control
 *   showLoading("Loading...");
 *   // ...async work...
 *   hideLoading();
 *
 *   // Or wrap a promise — loading shows until the promise settles
 *   await withLoading(() => fetchSomething(), "Fetching...");
 *
 * `withLoading` is safe: if a newer loading call appears before the wrapped
 * promise finishes, the hide is skipped so the latest loading stays visible.
 */
export function useLoading() {
  const show = useLoadingStore((s) => s.show);
  const hide = useLoadingStore((s) => s.hide);
  const tokenRef = useRef(0);

  const showLoading = useCallback(
    (text?: string) => {
      show(text);
    },
    [show],
  );

  const hideLoading = useCallback(() => {
    hide();
  }, [hide]);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, text?: string): Promise<T> => {
      const token = ++tokenRef.current;
      show(text);
      try {
        return await fn();
      } finally {
        // Only hide if no newer loading call has been issued.
        if (token === tokenRef.current) {
          hide();
        }
      }
    },
    [show, hide],
  );

  return { showLoading, hideLoading, withLoading };
}
