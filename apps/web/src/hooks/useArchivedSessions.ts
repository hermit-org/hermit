import { useCallback, useEffect, useState } from "react";

/**
 * Archive list for sessions, persisted to localStorage and keyed by gateway id.
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

function load(gatewayId: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(gatewayId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function save(gatewayId: string, ids: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(gatewayId), JSON.stringify([...ids]));
  } catch {
    // Ignore write errors (e.g. quota / disabled storage).
  }
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
export function useArchivedSessions(gatewayId: string | null): ArchivedSessionsApi {
  const [archived, setArchived] = useState<Set<string>>(() =>
    gatewayId ? load(gatewayId) : new Set(),
  );

  // Reload from storage whenever the gateway changes.
  useEffect(() => {
    setArchived(gatewayId ? load(gatewayId) : new Set());
  }, [gatewayId]);

  const has = useCallback((id: string) => archived.has(id), [archived]);

  const add = useCallback(
    (id: string) => {
      setArchived((prev) => {
        if (prev.has(id)) {
          if (gatewayId) save(gatewayId, prev);
          return prev;
        }
        const next = new Set(prev);
        next.add(id);
        if (gatewayId) save(gatewayId, next);
        return next;
      });
    },
    [gatewayId],
  );

  const remove = useCallback(
    (id: string) => {
      setArchived((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        if (gatewayId) save(gatewayId, next);
        return next;
      });
    },
    [gatewayId],
  );

  const all = useCallback(() => new Set(archived), [archived]);

  return { archived, has, add, remove, all };
}
