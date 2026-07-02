import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { FEATURE_FLAG_DEFAULTS } from "@/lib/feature-flags";

export type AppLanguage = "en" | "zh";

/**
 * Automatic-archive threshold expressed as a human-readable duration string
 * such as `"3d"`, `"2h"`, `"30m"`. An empty string disables auto-archiving.
 * Sessions older than this threshold (per `updatedAt`) and not in the local
 * open list are archived each time the session list is refreshed.
 */
export type AutoArchiveThreshold = string;

export interface SettingsState {
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
  /** Whether to show desktop notifications when a turn completes. */
  desktopNotifications: boolean;
  setDesktopNotifications: (enabled: boolean) => void;
  /** Feature flag: show agent thought/reasoning blocks in the transcript. */
  showThoughts: boolean;
  setShowThoughts: (enabled: boolean) => void;
  /** Feature flag: show the agent plan/todo bar above the composer. */
  showPlan: boolean;
  setShowPlan: (enabled: boolean) => void;
  /** Feature flag: show token usage / cost stats in the status bar. */
  showUsageStats: boolean;
  setShowUsageStats: (enabled: boolean) => void;
  /** Feature flag: show the agent config-option bar above the composer. */
  showConfigBar: boolean;
  setShowConfigBar: (enabled: boolean) => void;
  /** Feature flag: show the right tool-call panel (and its toggle). */
  showRightPanel: boolean;
  setShowRightPanel: (enabled: boolean) => void;
  /** Whether to apply a typewriter effect to streaming agent output. */
  typewriterEnabled: boolean;
  setTypewriterEnabled: (enabled: boolean) => void;
  /** Characters revealed per tick while streaming (typewriter speed). */
  typewriterSpeed: number;
  setTypewriterSpeed: (speed: number) => void;
  /** Tick interval in milliseconds between typewriter reveals. */
  typewriterInterval: number;
  setTypewriterInterval: (interval: number) => void;
  /** Speed multiplier applied when the stream ends, to flush the tail quickly. */
  typewriterFastMultiplier: number;
  setTypewriterFastMultiplier: (multiplier: number) => void;
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
      ...FEATURE_FLAG_DEFAULTS,
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
      desktopNotifications: false,
      setDesktopNotifications: (desktopNotifications) =>
        set({ desktopNotifications }),
      setShowThoughts: (showThoughts) => set({ showThoughts }),
      setShowPlan: (showPlan) => set({ showPlan }),
      setShowUsageStats: (showUsageStats) => set({ showUsageStats }),
      setShowConfigBar: (showConfigBar) => set({ showConfigBar }),
      setShowRightPanel: (showRightPanel) => set({ showRightPanel }),
      typewriterEnabled: true,
      setTypewriterEnabled: (typewriterEnabled) => set({ typewriterEnabled }),
      typewriterSpeed: 4,
      setTypewriterSpeed: (speed) =>
        set({ typewriterSpeed: Math.max(1, Math.min(50, Math.round(speed))) }),
      typewriterInterval: 16,
      setTypewriterInterval: (interval) =>
        set({
          typewriterInterval: Math.max(1, Math.min(200, Math.round(interval))),
        }),
      typewriterFastMultiplier: 8,
      setTypewriterFastMultiplier: (multiplier) =>
        set({
          typewriterFastMultiplier: Math.max(
            2,
            Math.min(50, Math.round(multiplier)),
          ),
        }),
    }),
    {
      name: "hermit-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
