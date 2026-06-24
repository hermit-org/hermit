import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hermitStorage } from "./mmkv";
import { setStoredLanguage } from "../i18n";

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

  setTheme: (theme: SettingsState["theme"]) => void;
  setCodeTheme: (theme: SettingsState["codeTheme"]) => void;
  setLanguage: (language: AppLanguage) => void;
  setThoughtPreviewLines: (lines: number) => void;
  setAutoArchiveThreshold: (threshold: string) => void;
  setAutoAuthenticate: (value: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
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
      setTheme(theme) {
        set({ theme });
      },
      setCodeTheme(codeTheme) {
        set({ codeTheme });
      },
      setLanguage(language) {
        set({ language });
        setStoredLanguage(language);
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
    }),
    {
      name: "hermit-settings",
      storage: {
        getItem: (name: string) => {
          const value = hermitStorage.getString(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name: string, value: unknown) => {
          hermitStorage.set(name, JSON.stringify(value));
        },
        removeItem: (name: string) => {
          hermitStorage.delete(name);
        },
      },
    },
  ),
);
