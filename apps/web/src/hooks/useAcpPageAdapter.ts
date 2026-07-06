/**
 * Web-specific wrapper around the shared `@hermit-org/acp-hooks` page adapter.
 *
 * Binds the platform's localStorage storage adapter, `/api/config` cwd lookup,
 * and browser confirmation dialogs before delegating to the shared hook. Also
 * wires image attachments: browser `File` objects are decoded to base64 and
 * handed to the shared hook, while blob URLs are used for previews (released on
 * removal / send).
 */
import { useCallback } from "react";
import {
  useAcpPageAdapter as useAcpPageAdapterBase,
  type UseAcpPageAdapterResult,
  type AttachmentInput,
} from "@hermit-org/acp-hooks";
import { useAcpClient } from "../acp/hooks";
import { useSettingsStore } from "../stores/settingsStore";
import { useConfigStore } from "../stores/configStore";
import { showNotification } from "../lib/notifications";
import type { Gateway } from "../types";

/**
 * Per-origin cache of the agent cwd reported by `/api/config`.
 *
 * The cwd is fixed for the lifetime of an agent process, so it only needs to
 * be fetched once per gateway origin. Caching at module scope keeps it across
 * re-renders and re-mounts, avoiding repeated `/api/config` requests.
 */
const agentCwdCache = new Map<string, string>();

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

/** Read a File as base64 (without the data-URL prefix). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

export type UseAcpPageAdapterWebResult = UseAcpPageAdapterResult & {
  /** Add browser image files to the draft (decoded to base64 internally). */
  onAttachImages: (files: File[]) => Promise<void>;
};

export function useAcpPageAdapter(
  gateway: Gateway | null,
): UseAcpPageAdapterWebResult {
  const acp = useAcpClient({ gateway, autoConnect: true });
  const autoArchiveThreshold = useSettingsStore((s) => s.autoArchiveThreshold);

  // Resolve the agent cwd from the page-load config fetch (configStore), then
  // cache it per gateway origin. The configStore is populated in parallel with
  // the SSE auto-connect, so this avoids a redundant `/api/config` round trip
  // in the common case. If the store hasn't loaded yet (e.g. this effect fires
  // before the page-load fetch completes), fall back to a direct fetch.
  const getAgentCwd = useCallback(async (gw: Gateway): Promise<string> => {
    const origin = new URL(gw.url).origin;
    const cached = agentCwdCache.get(origin);
    if (cached) return cached;

    // Prefer the already-loaded config from the store.
    const storeConfig = useConfigStore.getState().config;
    if (storeConfig?.agent?.cwd) {
      agentCwdCache.set(origin, storeConfig.agent.cwd);
      return storeConfig.agent.cwd;
    }

    // Store not loaded yet — fetch directly as a fallback so the caller is not
    // blocked waiting for the page-load fetch.
    try {
      await useConfigStore.getState().loadConfig(origin);
      const config = useConfigStore.getState().config;
      const cwd = config?.agent?.cwd ?? "/";
      agentCwdCache.set(origin, cwd);
      return cwd;
    } catch {
      return "/";
    }
  }, []);

  const adapter = useAcpPageAdapterBase({
    gateway,
    acp,
    storage: localStorageAdapter,
    autoArchiveThreshold,
    getAgentCwd,
    onConfirmArchive: () =>
      typeof window !== "undefined" && window.confirm("Archive this session?"),
    onConfirmDelete: () =>
      typeof window !== "undefined" && window.confirm("Delete this session?"),
    onTurnComplete: (assistantText) => {
      const enabled = useSettingsStore.getState().desktopNotifications;
      if (!enabled) return;
      const body = assistantText || "";
      showNotification("Hermit", body);
    },
    // Use blob URLs for previews (cheaper than data URLs for large images).
    createPreviewUrl: (input) => {
      const bytes = atob(input.data);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return URL.createObjectURL(new Blob([arr], { type: input.mimeType }));
    },
    revokePreviewUrl: (previewUrl) => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
  });

  // Decode browser File[] to base64 and forward to the shared hook.
  const onAttachImages = useCallback(
    async (files: File[]) => {
      const slots = adapter.maxAttachments - adapter.attachments.length;
      const picked = files.slice(0, Math.max(0, slots));
      if (picked.length === 0) return;
      const inputs: AttachmentInput[] = await Promise.all(
        picked.map(async (file) => ({
          name: file.name,
          mimeType: file.type || "image/png",
          data: await readFileAsBase64(file),
        })),
      );
      adapter.onAddAttachments(inputs);
    },
    [adapter],
  );

  return { ...adapter, onAttachImages };
}
