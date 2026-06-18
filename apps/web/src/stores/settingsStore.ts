import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SettingsState {
  /**
   * How many lines of an agent "thought" block to show in its collapsed
   * preview. The full text is revealed when the user expands the block.
   */
  thoughtPreviewLines: number;
  setThoughtPreviewLines: (lines: number) => void;
}

const DEFAULT_THOUGHT_PREVIEW_LINES = 4;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      thoughtPreviewLines: DEFAULT_THOUGHT_PREVIEW_LINES,
      setThoughtPreviewLines: (lines) =>
        set({
          thoughtPreviewLines: Math.max(1, Math.min(50, Math.round(lines))),
        }),
    }),
    {
      name: "hermit-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
