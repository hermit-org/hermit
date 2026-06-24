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

  const adapter = useAcpPageAdapterBase({
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
