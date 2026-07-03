import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hermitStorage } from "./mmkv";

export type AppLanguage = "en" | "zh" | "system";

interface SettingsState {
  theme: "light" | "dark" | "system";
  codeTheme: "atomOneDark" | "atomOneLight";
  language: AppLanguage;
  /** Number of thought lines to preview before collapsing (0 = collapsed). */
  thoughtPreviewLines: number;
  /** Auto-archive threshold, e.g. "3d" or "" to disable. */
  autoArchiveThreshold: string;
  /** Whether to automatically authenticate with the first advertised method. */
  autoAuthenticate: boolean;
  /** Whether the session sidebar/drawer is open. */
  sidebarOpen: boolean;
  /** Whether the right tool/permissions panel is open. */
  rightPanelOpen: boolean;
  /** Whether to show the archived sessions section in the session drawer. */
  showArchivedSessions: boolean;

  // Feature flags
  showThoughts: boolean;
  showPlan: boolean;
  showUsageStats: boolean;
  showConfigBar: boolean;
  showRightPanel: boolean;
  acpExt: boolean;

  setTheme: (theme: SettingsState["theme"]) => void;
  setCodeTheme: (theme: SettingsState["codeTheme"]) => void;
  setLanguage: (language: AppLanguage) => void;
  setThoughtPreviewLines: (lines: number) => void;
  setAutoArchiveThreshold: (threshold: string) => void;
  setAutoAuthenticate: (value: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setShowArchivedSessions: (show: boolean) => void;
  setShowThoughts: (value: boolean) => void;
  setShowPlan: (value: boolean) => void;
  setShowUsageStats: (value: boolean) => void;
  setShowConfigBar: (value: boolean) => void;
  setShowRightPanel: (value: boolean) => void;
  setAcpExt: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      codeTheme: "atomOneDark",
      language: "system",
      thoughtPreviewLines: 0,
      autoArchiveThreshold: "",
      autoAuthenticate: false,
      sidebarOpen: true,
      rightPanelOpen: false,
      showArchivedSessions: true,
      // Feature flag defaults (aligned with web)
      showThoughts: true,
      showPlan: true,
      showUsageStats: true,
      showConfigBar: true,
      showRightPanel: false,
      acpExt: false,
      setTheme(theme) {
        set({ theme });
      },
      setCodeTheme(codeTheme) {
        set({ codeTheme });
      },
      setLanguage(language) {
        set({ language });
      },
      setThoughtPreviewLines(thoughtPreviewLines) {
        set({ thoughtPreviewLines });
      },
      setAutoArchiveThreshold(autoArchiveThreshold) {
        set({ autoArchiveThreshold });
      },
      setAutoAuthenticate(autoAuthenticate) {
        set({ autoAuthenticate });
      },
      setSidebarOpen(sidebarOpen) {
        set({ sidebarOpen });
      },
      setRightPanelOpen(rightPanelOpen) {
        set({ rightPanelOpen });
      },
      setShowArchivedSessions(showArchivedSessions) {
        set({ showArchivedSessions });
      },
      setShowThoughts(showThoughts) {
        set({ showThoughts });
      },
      setShowPlan(showPlan) {
        set({ showPlan });
      },
      setShowUsageStats(showUsageStats) {
        set({ showUsageStats });
      },
      setShowConfigBar(showConfigBar) {
        set({ showConfigBar });
      },
      setShowRightPanel(showRightPanel) {
        set({ showRightPanel });
      },
      setAcpExt(acpExt) {
        set({ acpExt });
      },
    }),
    {
      name: "hermit-settings",
      storage: {
        getItem: (name: string) => {
          try {
            const value = hermitStorage.getString(name);
            return value ? JSON.parse(value) : null;
          } catch (e) {
            console.error("[settingsStore] failed to read persisted state:", e);
            return null;
          }
        },
        setItem: (name: string, value: unknown) => {
          try {
            hermitStorage.set(name, JSON.stringify(value));
          } catch (e) {
            console.error("[settingsStore] failed to persist state:", e);
          }
        },
        removeItem: (name: string) => {
          try {
            hermitStorage.delete(name);
          } catch (e) {
            console.error("[settingsStore] failed to remove persisted state:", e);
          }
        },
      },
    },
  ),
);
