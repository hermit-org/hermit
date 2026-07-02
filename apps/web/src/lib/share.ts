/**
 * Share configuration (gateway + settings) via URL-safe Base64 encoded links.
 *
 * A share link encodes a {@link SharePayload} into `#s=<base64url>` in the URL
 * hash (not the query string, so it never reaches server logs). The receiver
 * opens the link and the app auto-imports the gateway and applies the settings.
 *
 * @example
 * const url = buildShareUrl("https://app.example.com", { ... });
 * const payload = readShareFromHash(); // → SharePayload | null
 */

import { useGatewayStore } from "@/stores/gatewayStore";
import { useSettingsStore, type AppLanguage } from "@/stores/settingsStore";
import { changeAppLanguage } from "@/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Gateway fields that are shareable (no id/timestamps). */
export interface ShareableGateway {
  name: string;
  url: string;
  token: string;
}

/** Settings fields safe to share (excludes layout state like sidebarOpen). */
export interface ShareableSettings {
  language: AppLanguage;
  autoArchiveThreshold: string;
  autoAuthenticate: boolean;
  desktopNotifications: boolean;
  showArchivedSessions: boolean;
  showThoughts: boolean;
  showPlan: boolean;
  showUsageStats: boolean;
  showConfigBar: boolean;
  showRightPanel: boolean;
  typewriterEnabled: boolean;
  typewriterSpeed: number;
  typewriterInterval: number;
  typewriterFastMultiplier: number;
  thoughtPreviewLines: number;
}

/** The complete payload embedded in a share link. */
export interface SharePayload {
  /** Schema version for forward compatibility. */
  v: 1;
  /** Gateway to share (omitted when the user shares settings only). */
  g?: ShareableGateway;
  /** Settings to share (omitted when the user shares a gateway only). */
  s?: Partial<ShareableSettings>;
}

/** Options for {@link buildShareUrl}. */
export interface BuildShareOptions {
  /** Gateway to include (null to share settings only). */
  gateway?: ShareableGateway | null;
  /** Settings to include (null to share gateway only). */
  settings?: Partial<ShareableSettings> | null;
}

// ---------------------------------------------------------------------------
// Base64 URL-safe encode / decode
// ---------------------------------------------------------------------------

/**
 * Encode a UTF-8 string to URL-safe Base64.
 * Replaces `+` → `-`, `/` → `_`, strips padding `=`.
 */
function encodeBase64Url(str: string): string {
  // Handle UTF-8: encode to bytes, then to base64.
  const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16)),
  );
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a URL-safe Base64 string back to UTF-8 text.
 * Restores padding, reverses `-_` → `+/`, then decodes UTF-8.
 */
function decodeBase64Url(str: string): string {
  const restored = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = restored + "=".repeat((4 - (restored.length % 4)) % 4);
  const binary = atob(padded);
  // Decode UTF-8 bytes back to a JS string.
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Payload serialization
// ---------------------------------------------------------------------------

/** Encode a {@link SharePayload} to a URL-safe Base64 string. */
export function encodeSharePayload(payload: SharePayload): string {
  return encodeBase64Url(JSON.stringify(payload));
}

/** Decode a URL-safe Base64 string to a {@link SharePayload}, or `null` on failure. */
export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const json = decodeBase64Url(encoded);
    const parsed = JSON.parse(json) as SharePayload;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build / read share URLs
// ---------------------------------------------------------------------------

/**
 * Build a shareable URL carrying the given gateway and/or settings.
 *
 * @param webBaseUrl - The app's base URL (e.g. `https://app.example.com`).
 * @param opts       - What to include in the share link.
 * @returns A URL with `#s=<base64url>` hash fragment.
 */
export function buildShareUrl(
  webBaseUrl: string,
  opts: BuildShareOptions,
): string {
  const payload: SharePayload = { v: 1 };

  if (opts.gateway) {
    payload.g = {
      name: opts.gateway.name,
      url: opts.gateway.url,
      token: opts.gateway.token,
    };
  }

  if (opts.settings) {
    payload.s = opts.settings;
  }

  const base = webBaseUrl.replace(/[?#].*$/, "");
  return `${base}#s=${encodeSharePayload(payload)}`;
}

/**
 * Check the current page URL for a share hash (`#s=...`).
 *
 * Returns the decoded {@link SharePayload} or `null` when no valid share
 * fragment is present. Does NOT consume (remove) the hash — call
 * {@link clearShareHash} afterwards.
 */
export function readShareFromHash(): SharePayload | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#s=")) return null;
  const encoded = hash.slice(3);
  if (!encoded) return null;
  return decodeSharePayload(encoded);
}

/**
 * Remove the `#s=...` fragment from the URL so a page refresh doesn't
 * re-trigger the import. Uses `replaceState` so it doesn't add history entries.
 */
export function clearShareHash(): void {
  if (typeof window === "undefined") return;
  if (!window.location.hash.startsWith("#s=")) return;
  window.history.replaceState(
    {},
    "",
    window.location.pathname + window.location.search,
  );
}

// ---------------------------------------------------------------------------
// Collect / apply
// ---------------------------------------------------------------------------

/**
 * Collect the shareable settings from the persisted settings store.
 * Returns only fields that are meaningful to share (no setter functions,
 * no ephemeral layout state like `sidebarOpen`).
 */
export function collectShareableSettings(): ShareableSettings {
  const s = useSettingsStore.getState();
  return {
    language: s.language,
    autoArchiveThreshold: s.autoArchiveThreshold,
    autoAuthenticate: s.autoAuthenticate,
    desktopNotifications: s.desktopNotifications,
    showArchivedSessions: s.showArchivedSessions,
    showThoughts: s.showThoughts,
    showPlan: s.showPlan,
    showUsageStats: s.showUsageStats,
    showConfigBar: s.showConfigBar,
    showRightPanel: s.showRightPanel,
    typewriterEnabled: s.typewriterEnabled,
    typewriterSpeed: s.typewriterSpeed,
    typewriterInterval: s.typewriterInterval,
    typewriterFastMultiplier: s.typewriterFastMultiplier,
    thoughtPreviewLines: s.thoughtPreviewLines,
  };
}

/**
 * Apply a decoded {@link SharePayload} to the gateway and settings stores.
 *
 * - Gateway: added via `addGateway` if an identical (url+token) gateway
 *   doesn't already exist. Returns the resolved gateway id.
 * - Settings: each field present in `payload.s` is applied individually.
 *
 * @returns `true` if anything was imported, `false` if nothing to apply.
 */
export function applySharePayload(payload: SharePayload): boolean {
  let imported = false;

  // --- Gateway ---
  if (payload.g?.url && payload.g?.token) {
    const store = useGatewayStore.getState();
    const exists = store.gateways.some(
      (gw) => gw.url === payload.g!.url && gw.token === payload.g!.token,
    );
    if (!exists) {
      store.addGateway({
        name: payload.g.name || "Shared Gateway",
        url: payload.g.url,
        token: payload.g.token,
        sendUrl: "",
      });
    }
    imported = true;
  }

  // --- Settings ---
  if (payload.s) {
    const s = payload.s;
    const setters = useSettingsStore.getState();

    if (s.language !== undefined) {
      setters.setLanguage(s.language);
      changeAppLanguage(s.language);
    }
    if (s.autoArchiveThreshold !== undefined)
      setters.setAutoArchiveThreshold(s.autoArchiveThreshold);
    if (s.autoAuthenticate !== undefined)
      setters.setAutoAuthenticate(s.autoAuthenticate);
    if (s.desktopNotifications !== undefined)
      setters.setDesktopNotifications(s.desktopNotifications);
    if (s.showArchivedSessions !== undefined)
      setters.setShowArchivedSessions(s.showArchivedSessions);
    if (s.showThoughts !== undefined) setters.setShowThoughts(s.showThoughts);
    if (s.showPlan !== undefined) setters.setShowPlan(s.showPlan);
    if (s.showUsageStats !== undefined) setters.setShowUsageStats(s.showUsageStats);
    if (s.showConfigBar !== undefined) setters.setShowConfigBar(s.showConfigBar);
    if (s.showRightPanel !== undefined)
      setters.setShowRightPanel(s.showRightPanel);
    if (s.typewriterEnabled !== undefined)
      setters.setTypewriterEnabled(s.typewriterEnabled);
    if (s.typewriterSpeed !== undefined)
      setters.setTypewriterSpeed(s.typewriterSpeed);
    if (s.typewriterInterval !== undefined)
      setters.setTypewriterInterval(s.typewriterInterval);
    if (s.typewriterFastMultiplier !== undefined)
      setters.setTypewriterFastMultiplier(s.typewriterFastMultiplier);
    if (s.thoughtPreviewLines !== undefined)
      setters.setThoughtPreviewLines(s.thoughtPreviewLines);

    imported = true;
  }

  return imported;
}
