import { create } from "zustand";
import type { AppLanguage } from "./settingsStore";
import { useSettingsStore } from "./settingsStore";

/**
 * Shape of the `/api/config` response from the Hermit gateway.
 *
 * The server may include theme, language, and agent-list overrides alongside
 * the core agent/gateway connection info. All fields are optional so the client
 * gracefully degrades when the server omits them.
 */
export interface ClientConfig {
  agent?: {
    command?: string;
    args?: string[];
    cwd?: string;
  };
  gateway?: {
    url?: string;
    sendUrl?: string;
    endpoint?: string;
    port?: number;
  };
  theme?: "light" | "dark" | "system";
  language?: AppLanguage;
  agents?: Array<{
    id: string;
    name: string;
    command: string;
    args: string[];
    cwd?: string;
  }>;
  activeAgentId?: string | null;
}

interface ConfigStoreState {
  /** The most recently loaded config, or `null` while loading / on error. */
  config: ClientConfig | null;
  /** `true` while a fetch is in flight. */
  loading: boolean;
  /** Set when the last fetch failed; cleared on the next successful fetch. */
  error: Error | null;
  /**
   * Fetch `/api/config` from the given gateway origin and apply theme/language
   * overrides. Safe to call multiple times — concurrent calls are deduplicated.
   * Always resolves (never rejects); failures are stored in `error`.
   */
  loadConfig: (origin: string) => Promise<void>;
  /** Reset to initial state (e.g. when switching gateways). */
  reset: () => void;
}

// Module-scope guard so multiple components calling `loadConfig` on the same
// origin only trigger a single network request.
let inflightOrigin: string | null = null;
let inflightPromise: Promise<void> | null = null;

/**
 * Apply a theme string ("light" | "dark" | "system") to the document root and
 * persist it to localStorage, matching how `settings-page.tsx` restores the
 * theme on mount.
 */
function applyTheme(theme: "light" | "dark" | "system"): void {
  if (typeof document === "undefined") return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  try {
    localStorage.setItem("hermit-theme", theme);
  } catch {
    // Ignore quota / privacy errors.
  }
}

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  config: null,
  loading: false,
  error: null,

  loadConfig: async (origin: string) => {
    // Deduplicate: if a fetch for the same origin is already in flight, ride
    // on it instead of starting a parallel request.
    if (inflightOrigin === origin && inflightPromise) {
      return inflightPromise;
    }

    set({ loading: true, error: null });

    const promise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(`${origin}/api/config`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const data = (await res.json()) as ClientConfig;

        // Apply theme override if the server provides one.
        if (data.theme) {
          applyTheme(data.theme);
        }

        // Apply language override if the server provides one. Only set it when
        // the value differs from the current setting to avoid unnecessary
        // re-renders.
        if (data.language) {
          const current = useSettingsStore.getState().language;
          if (current !== data.language) {
            useSettingsStore.getState().setLanguage(data.language);
          }
        }

        set({ config: data, loading: false, error: null });
      } catch (e) {
        // On failure, leave `config` as-is (null on first load) so callers fall
        // back to defaults. SSE connection is unaffected.
        set({
          loading: false,
          error: e instanceof Error ? e : new Error(String(e)),
        });
      } finally {
        clearTimeout(timeoutId);
        inflightOrigin = null;
        inflightPromise = null;
      }
    })();

    inflightOrigin = origin;
    inflightPromise = promise;
    return promise;
  },

  reset: () => {
    inflightOrigin = null;
    inflightPromise = null;
    set({ config: null, loading: false, error: null });
  },
}));
