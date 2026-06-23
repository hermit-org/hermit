import { useSyncExternalStore } from "react";

/**
 * All navigable routes in the web app. Pathname → Route is handled by
 * `parseRoute`.
 *
 *   /                 → gateways (landing / manager)
 *   /gateways         → gateways (alias)
 *   /g/:gatewayId     → real chat for a gateway
 *   /settings         → settings page
 */
export type Route =
  | { name: "gateways" }
  | { name: "real"; gatewayId: string }
  | { name: "settings" }
  | { name: "not-found"; path: string };

const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) cb();
}

// Listeners are registered lazily on the first subscriber and removed when the
// last one unsubscribes, so importing this module in tests/SSR has no side
// effects and repeated imports don't leak duplicate listeners.
let windowListenersBound = false;

function bindWindowListeners(): void {
  if (typeof window === "undefined" || windowListenersBound) return;
  windowListenersBound = true;
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
}

function maybeUnbindWindowListeners(): void {
  if (typeof window === "undefined" || subscribers.size > 0) return;
  if (!windowListenersBound) return;
  windowListenersBound = false;
  window.removeEventListener("popstate", notify);
  window.removeEventListener("hashchange", notify);
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Parse a pathname into a typed Route. Unknown paths → not-found. */
export function parseRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) return { name: "gateways" };
  if (parts[0] === "gateways") return { name: "gateways" };
  if (parts[0] === "g" && parts[1]) {
    return { name: "real", gatewayId: decode(parts[1]) };
  }
  if (parts[0] === "settings") return { name: "settings" };

  return { name: "not-found", path: pathname };
}

/** Build a path for a gateway in the new UI. */
export function realGatewayPath(gatewayId: string): string {
  return `/g/${encodeURIComponent(gatewayId)}`;
}

// Snapshot cache: parseRoute returns a new object each call, so we must
// memoize on the pathname string for useSyncExternalStore (Object.is compare).
let cachedPathname = "";
let cachedRoute: Route = { name: "gateways" };

function getSnapshot(): Route {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  if (pathname !== cachedPathname) {
    cachedPathname = pathname;
    cachedRoute = parseRoute(pathname);
  }
  return cachedRoute;
}

function getServerSnapshot(): Route {
  return { name: "gateways" };
}

function subscribe(cb: () => void): () => void {
  if (subscribers.size === 0) bindWindowListeners();
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
    maybeUnbindWindowListeners();
  };
}

/** Subscribe to the current route. Re-renders on navigation / popstate. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

/** Navigate to a path. Defaults to a new history entry (pushState). */
export function navigate(to: string, opts?: NavigateOptions): void {
  if (typeof window === "undefined") return;
  if (opts?.replace) {
    window.history.replaceState({}, "", to);
  } else {
    window.history.pushState({}, "", to);
  }
  notify();
}

/** Navigate back in history (falls back to a path if there's no history). */
export function navigateBack(fallback: string): void {
  if (typeof window === "undefined") return;
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate(fallback);
  }
}
