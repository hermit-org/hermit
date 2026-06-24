import type { StorageAdapter } from "@hermit-org/acp-hooks";
import { hermitStorage } from "./mmkv";

/**
 * MMKV-backed StorageAdapter for `@hermit-org/acp-hooks`.
 */
export const mmkvAdapter: StorageAdapter = {
  getItem(name: string) {
    return hermitStorage.getString(name) ?? null;
  },
  setItem(name: string, value: string) {
    hermitStorage.set(name, value);
  },
  removeItem(name: string) {
    hermitStorage.delete(name);
  },
};
