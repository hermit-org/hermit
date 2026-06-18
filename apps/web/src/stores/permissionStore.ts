import { create } from "zustand";
import type {
  RequestPermissionParams,
  RequestPermissionResult,
  ToolCallUpdate,
} from "@hermit/acp";

/**
 * A pending permission request raised by the agent via
 * `session/request_permission`. The UI resolves it by calling
 * `resolve()` / `reject()` on the stored entry.
 */
export interface PendingPermission {
  id: string;
  toolCall: Partial<ToolCallUpdate> & { toolCallId: string };
  options: RequestPermissionParams["options"];
  resolve: (result: RequestPermissionResult) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

export interface PermissionState {
  pending: PendingPermission[];
  /** Enqueue a new permission request and return the result promise. */
  request(params: RequestPermissionParams): Promise<RequestPermissionResult>;
  /** Resolve a pending request with the chosen outcome. */
  respond(id: string, optionId: string): void;
  /** Cancel a pending request (e.g. user dismissed the dialog). */
  cancel(id: string): void;
  /** Remove a request without resolving (used on disconnect). */
  clear(): void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  pending: [],

  request(params) {
    return new Promise<RequestPermissionResult>((resolve, reject) => {
      const id =
        params.toolCall?.toolCallId ??
        `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: PendingPermission = {
        id,
        toolCall: params.toolCall,
        options: params.options,
        resolve,
        reject,
        createdAt: Date.now(),
      };
      set((state) => ({ pending: [...state.pending, entry] }));
    });
  },

  respond(id, optionId) {
    const entry = get().pending.find((p) => p.id === id);
    if (!entry) return;
    set((state) => ({ pending: state.pending.filter((p) => p.id !== id) }));
    entry.resolve({ outcome: { outcome: "selected", optionId } });
  },

  cancel(id) {
    const entry = get().pending.find((p) => p.id === id);
    if (!entry) return;
    set((state) => ({ pending: state.pending.filter((p) => p.id !== id) }));
    entry.reject(new Error("Permission request dismissed"));
  },

  clear() {
    const entries = get().pending;
    set({ pending: [] });
    for (const entry of entries) {
      entry.reject(new Error("Connection closed"));
    }
  },
}));
