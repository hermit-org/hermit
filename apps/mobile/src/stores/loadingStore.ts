import { create } from "zustand";

interface LoadingState {
  /** Whether the global loading overlay is visible. */
  visible: boolean;
  /** Optional message displayed under the spinner. */
  text: string;
  /** Show the global loading overlay with an optional message. */
  show: (text?: string) => void;
  /** Hide the global loading overlay. */
  hide: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  visible: false,
  text: "",
  show: (text = "") => set({ visible: true, text }),
  hide: () => set({ visible: false, text: "" }),
}));
