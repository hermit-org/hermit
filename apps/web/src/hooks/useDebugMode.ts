import { useMemo } from "react";

/**
 * Returns true when the current URL contains the `__debug__` query param.
 * When enabled, tool-call cards reveal raw input/output blocks in addition to
 * their parsed content.
 */
export function useDebugMode(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("__debug__");
  }, []);
}
