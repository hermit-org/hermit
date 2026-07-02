import { create } from "zustand";
import type {
  RequestPermissionParams,
  RequestPermissionResult,
  ToolCallUpdate,
} from "@hermit-org/acp";

/**
 * A pending permission request raised by the agent via
 * `session/request_permission`. The UI resolves it by calling
 * `resolve()` / `reject()` on the stored entry.
 */
export interface PendingPermissionRequest {
  id: string;
  toolCall: Partial<ToolCallUpdate> & { toolCallId: string };
  options: RequestPermissionParams["options"];
  resolve: (result: RequestPermissionResult) => Promise<void> | void;
  reject: (error: Error) => Promise<void> | void;
  createdAt: number;
}

/**
 * A tool question the user has already answered. Kept so the user can review
 * all questions and answers after confirming.
 */
export interface AnsweredPermission {
  toolCallId: string;
  question: string;
  answer: string;
  note?: string;
  at: number;
}

export interface PermissionState {
  pending: PendingPermissionRequest[];
  /** Tool questions the user already answered (newest first). */
  history: AnsweredPermission[];
  /** Enqueue a new permission request and return the result promise. */
  request(params: RequestPermissionParams): Promise<RequestPermissionResult>;
  /** Resolve a pending request with the chosen outcome (and optional note). */
  respond(id: string, optionId: string, note?: string): void;
  /** Resolve every pending request at once and record answers in history. */
  respondAll(
    responses: { id: string; optionId: string; note?: string }[],
  ): void;
  /** Cancel a pending request (e.g. user dismissed the dialog). */
  cancel(id: string): void;
  /** Remove a request without resolving (used on disconnect). */
  clear(): void;
  /** Clear the answer history. */
  clearHistory(): void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  pending: [],
  history: [],

  request(params) {
    return new Promise<RequestPermissionResult>((resolve, reject) => {
      // Always generate a unique id (even when multiple permissions share a
      // toolCallId) so `respond`/`cancel` only affect the intended entry.
      const toolCallId = params.toolCall?.toolCallId ?? "unknown";
      const id = `perm-${toolCallId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: PendingPermissionRequest = {
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

  respond(id, optionId, note) {
    const entry = get().pending.find((p) => p.id === id);
    if (!entry) return;
    set((state) => ({ pending: state.pending.filter((p) => p.id !== id) }));
    // Record the answer in history so the user can review it later.
    const opt = entry.options.find((o) => o.optionId === optionId);
    const answered: AnsweredPermission = {
      toolCallId: entry.id,
      question: entry.toolCall.title ?? entry.id,
      answer: opt?.name ?? optionId,
      note,
      at: Date.now(),
    };
    set((state) => ({ history: [answered, ...state.history] }));
    entry.resolve({
      outcome: { outcome: "selected", optionId, note },
    });
  },

  respondAll(responses) {
    const pending = get().pending;
    const answered: AnsweredPermission[] = [];
    for (const r of responses) {
      const entry = pending.find((p) => p.id === r.id);
      if (!entry) continue;
      const opt = entry.options.find((o) => o.optionId === r.optionId);
      answered.push({
        toolCallId: entry.id,
        question: entry.toolCall.title ?? entry.id,
        answer: opt?.name ?? r.optionId,
        note: r.note,
        at: Date.now(),
      });
      entry.resolve({
        outcome: { outcome: "selected", optionId: r.optionId, note: r.note },
      });
    }
    const answeredIds = new Set(responses.map((r) => r.id));
    set((state) => ({
      pending: state.pending.filter((p) => !answeredIds.has(p.id)),
      history: [...answered.reverse(), ...state.history],
    }));
  },

  cancel(id) {
    const entry = get().pending.find((p) => p.id === id);
    if (!entry) return;
    set((state) => ({ pending: state.pending.filter((p) => p.id !== id) }));
    entry.reject(new Error("Permission request dismissed"));
  },

  /**
   * Reject and drop all pending requests locally. This does NOT notify the
   * agent — it only clears the client-side queue. True cancellation would
   * require sending a cancellation notification to the agent.
   */
  clear() {
    const entries = get().pending;
    set({ pending: [] });
    for (const entry of entries) {
      entry.reject(new Error("Connection closed"));
    }
  },

  clearHistory() {
    set({ history: [] });
  },
}));
