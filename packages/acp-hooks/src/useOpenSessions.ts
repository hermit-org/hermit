import { useCallback, useEffect, useState } from "react";
import type { StorageAdapter } from "./types";

/**
 * Open-session list, persisted via the provided storage adapter and keyed by
 * gateway id.
 *
 * The open list tracks sessions this client has opened on the agent via
 * `session/new` or `session/load`. It is used to:
 *
 * - distinguish sessions that are currently "in use" by this client from
 *   sessions that merely exist on the agent (so archiving an open session can
 *   first call `session/close` to release resources).
 * - exempt in-use sessions from automatic archiving.
 *
 * The list is reconciled against `session/list` results via {@link syncWith}:
 * ids that no longer exist on the agent are pruned to avoid stale state.
 */
const STORAGE_PREFIX = "hermit-open-sessions:";

function storageKey(gatewayId: string): string {
  return `${STORAGE_PREFIX}${gatewayId}`;
}

async function load(
  gatewayId: string,
  storage: StorageAdapter,
): Promise<Set<string>> {
  try {
    const raw = await storage.getItem(storageKey(gatewayId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

async function save(
  gatewayId: string,
  storage: StorageAdapter,
  ids: Set<string>,
): Promise<void> {
  try {
    await storage.setItem(storageKey(gatewayId), JSON.stringify([...ids]));
  } catch {
    // Ignore write errors (e.g. quota / disabled storage).
  }
}

export interface UseOpenSessionsOptions {
  /** Gateway id used as the storage key. Null disables persistence. */
  gatewayId: string | null;
  /** Platform-specific storage adapter. */
  storage: StorageAdapter;
}

export interface OpenSessionsApi {
  /** The current set of open session ids. */
  open: Set<string>;
  /** Whether a given session id is open on this client. */
  has: (id: string) => boolean;
  /** Mark a session id as open (persisted). */
  add: (id: string) => void;
  /** Remove a session id from the open list (persisted). */
  remove: (id: string) => void;
  /**
   * Reconcile the open list against a known set of live session ids: drop any
   * open id that is not present. Returns the reconciled set.
   */
  syncWith: (liveIds: Iterable<string>) => Set<string>;
}

/**
 * Manage the open-session list for a gateway. Returns a stable API whose
 * `open` set updates whenever sessions are added, removed, or reconciled.
 */
export function useOpenSessions(
  options: UseOpenSessionsOptions,
): OpenSessionsApi {
  const { gatewayId, storage } = options;
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Reload from storage whenever the gateway changes.
  useEffect(() => {
    let cancelled = false;
    if (gatewayId) {
      load(gatewayId, storage).then((ids) => {
        if (!cancelled) setOpen(ids);
      });
    } else {
      setOpen(new Set());
    }
    return () => {
      cancelled = true;
    };
  }, [gatewayId, storage]);

  const has = useCallback((id: string) => open.has(id), [open]);

  const add = useCallback(
    (id: string) => {
      setOpen((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        if (gatewayId) save(gatewayId, storage, next);
        return next;
      });
    },
    [gatewayId, storage],
  );

  const remove = useCallback(
    (id: string) => {
      setOpen((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        if (gatewayId) save(gatewayId, storage, next);
        return next;
      });
    },
    [gatewayId, storage],
  );

  const syncWith = useCallback(
    (liveIds: Iterable<string>) => {
      const live = new Set(liveIds);
      // Compute the reconciled set synchronously so callers can rely on the
      // returned value reflecting the post-sync state (not a stale snapshot).
      let changed = false;
      const next = new Set<string>();
      for (const id of open) {
        if (live.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      if (!changed) return open;
      if (gatewayId) save(gatewayId, storage, next);
      setOpen(next);
      return next;
    },
    [gatewayId, storage, open],
  );

  return { open, has, add, remove, syncWith };
}
