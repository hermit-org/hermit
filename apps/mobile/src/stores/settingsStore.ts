import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hermitStorage } from "./mmkv";

export type AppLanguage = "en" | "zh" | "system";

interface SettingsState {
  theme: "light" | "dark" | "system";
  codeTheme: "atomOneDark" | "atomOneLight";
  language: AppLanguage;
  setTheme: (theme: SettingsState["theme"]) => void;
  setCodeTheme: (theme: SettingsState["codeTheme"]) => void;
  setLanguage: (language: AppLanguage) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      codeTheme: "atomOneDark",
      language: "system",
      setTheme(theme) {
        set({ theme });
      },
      setCodeTheme(codeTheme) {
        set({ codeTheme });
      },
      setLanguage(language) {
        set({ language });
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
