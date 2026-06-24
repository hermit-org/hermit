/**
 * Web-specific wrapper around the shared `@hermit-org/acp-hooks` page adapter.
 *
 * Binds the platform's localStorage storage adapter, `/api/config` cwd lookup,
 * and browser confirmation dialogs before delegating to the shared hook.
 */
import {
  useAcpPageAdapter as useAcpPageAdapterBase,
  type UseAcpPageAdapterResult,
} from "@hermit-org/acp-hooks";
import { useAcpClient } from "../acp/hooks";
import { useSettingsStore } from "../stores/settingsStore";
import type { Gateway } from "../types";

const localStorageAdapter = {
  getItem(name: string) {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name: string, value: string) {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Ignore quota errors.
    }
  },
  removeItem(name: string) {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  },
};

export function useAcpPageAdapter(
  gateway: Gateway | null,
): UseAcpPageAdapterResult {
  const acp = useAcpClient({ gateway, autoConnect: true });
  const autoArchiveThreshold = useSettingsStore((s) => s.autoArchiveThreshold);

  return useAcpPageAdapterBase({
    gateway,
    acp,
    storage: localStorageAdapter,
    autoArchiveThreshold,
    getAgentCwd: async (gw) => {
      const origin = new URL(gw.url).origin;
      const res = await fetch(`${origin}/api/config`);
      if (!res.ok) return "/";
      const data = (await res.json()) as { agent?: { cwd?: string } };
      return data?.agent?.cwd ?? "/";
    },
    onConfirmArchive: () =>
      typeof window !== "undefined" && window.confirm("Archive this session?"),
    onConfirmDelete: () =>
      typeof window !== "undefined" && window.confirm("Delete this session?"),
  });
}
