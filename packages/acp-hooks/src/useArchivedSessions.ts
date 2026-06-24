import { useCallback, useEffect, useState } from "react";
import type { StorageAdapter } from "./types";

/**
 * Archive list for sessions, persisted via the provided storage adapter and
 * keyed by gateway id.
 *
 * Archiving is a client-side-only operation: the session continues to exist on
 * the agent, but is hidden from the sidebar. On every `session/list` refresh
 * the returned set is used to filter out archived sessions.
 *
 * The archive list is stored per gateway so switching gateways shows a
 * different set of archived sessions.
 */
const STORAGE_PREFIX = "hermit-archived-sessions:";

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

export interface UseArchivedSessionsOptions {
  /** Gateway id used as the storage key. Null disables persistence. */
  gatewayId: string | null;
  /** Platform-specific storage adapter. */
  storage: StorageAdapter;
}

export interface ArchivedSessionsApi {
  /** The current set of archived session ids. */
  archived: Set<string>;
  /** Whether a given session id has been archived. */
  has: (id: string) => boolean;
  /** Archive a session id (persisted). */
  add: (id: string) => void;
  /** Remove a session id from the archive (persisted). */
  remove: (id: string) => void;
  /** Return a snapshot Set of all archived ids. */
  all: () => Set<string>;
}

/**
 * Manage the archived-session list for a gateway. Returns a stable API whose
 * `archived` set updates whenever sessions are added or removed.
 */
export function useArchivedSessions(
  options: UseArchivedSessionsOptions,
): ArchivedSessionsApi {
  const { gatewayId, storage } = options;
  const [archived, setArchived] = useState<Set<string>>(new Set());

  // Reload from storage whenever the gateway changes.
  useEffect(() => {
    let cancelled = false;
    if (gatewayId) {
      load(gatewayId, storage).then((ids) => {
        if (!cancelled) setArchived(ids);
      });
    } else {
      setArchived(new Set());
    }
    return () => {
      cancelled = true;
    };
  }, [gatewayId, storage]);

  const has = useCallback((id: string) => archived.has(id), [archived]);

  const add = useCallback(
    (id: string) => {
      setArchived((prev) => {
        if (prev.has(id)) {
          // Already archived — no state change, no pointless persistence write.
          return prev;
        }
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
      setArchived((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        if (gatewayId) save(gatewayId, storage, next);
        return next;
      });
    },
    [gatewayId, storage],
  );

  // Return the stable `archived` reference directly (not a fresh copy) so it
  // can be used as a stable effect dependency. Callers needing a snapshot can
  // construct one from the returned set.
  const all = useCallback(() => archived, [archived]);

  return { archived, has, add, remove, all };
}
