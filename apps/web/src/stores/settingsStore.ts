import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AppLanguage = "en" | "zh";

/**
 * Automatic-archive threshold expressed as a human-readable duration string
 * such as `"3d"`, `"2h"`, `"30m"`. An empty string disables auto-archiving.
 * Sessions older than this threshold (per `updatedAt`) and not in the local
 * open list are archived each time the session list is refreshed.
 */
export type AutoArchiveThreshold = string;

interface SettingsState {
  /**
   * How many lines of an agent "thought" block to show in its collapsed
   * preview. The full text is revealed when the user expands the block.
   */
  thoughtPreviewLines: number;
  setThoughtPreviewLines: (lines: number) => void;
  /** Display language. */
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  /** Whether the left session sidebar is expanded. */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  /** Whether the right tool panel is expanded. */
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  /** Whether to show the archived sessions section in the session sidebar. */
  showArchivedSessions: boolean;
  setShowArchivedSessions: (show: boolean) => void;
  /** Automatic-archive threshold (e.g. `"3d"`, `"2h"`, `""` to disable). */
  autoArchiveThreshold: AutoArchiveThreshold;
  setAutoArchiveThreshold: (threshold: AutoArchiveThreshold) => void;
  /** Whether to automatically authenticate when an agent advertises auth methods. */
  autoAuthenticate: boolean;
  setAutoAuthenticate: (enabled: boolean) => void;
}

const DEFAULT_THOUGHT_PREVIEW_LINES = 4;
/** Default auto-archive threshold: 3 days. */
const DEFAULT_AUTO_ARCHIVE_THRESHOLD = "3d";

// Initial language is derived from the browser. The persisted value (if any)
// replaces this after rehydration via the zustand `persist` middleware, so the
// navigator-based default only applies on first run / when nothing is stored.
function resolveDefaultLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return "en";
  const code = navigator.language.split("-")[0];
  return code === "zh" ? "zh" : "en";
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      thoughtPreviewLines: DEFAULT_THOUGHT_PREVIEW_LINES,
      setThoughtPreviewLines: (lines) =>
        set({
          thoughtPreviewLines: Math.max(1, Math.min(50, Math.round(lines))),
        }),
      language: resolveDefaultLanguage(),
      setLanguage: (language) => set({ language }),
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      rightPanelOpen: false,
      setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
      showArchivedSessions: true,
      setShowArchivedSessions: (showArchivedSessions) =>
        set({ showArchivedSessions }),
      autoArchiveThreshold: DEFAULT_AUTO_ARCHIVE_THRESHOLD,
      setAutoArchiveThreshold: (autoArchiveThreshold) =>
        set({ autoArchiveThreshold }),
      autoAuthenticate: false,
      setAutoAuthenticate: (autoAuthenticate) => set({ autoAuthenticate }),
    }),
    {
      name: "hermit-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
