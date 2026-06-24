import type { SessionInfo } from "@hermit-org/acp";

/**
 * Parse a duration string like `"3d"`, `"2h"`, `"30m"` into milliseconds.
 *
 * Supported suffixes: `d` (days), `h` (hours), `m` (minutes). An empty or
 * malformed string returns `0`, which disables auto-archiving.
 *
 * @example
 * parseDuration("3d") // 259_200_000
 * parseDuration("2h") // 7_200_000
 * parseDuration("")   // 0 (disabled)
 */
export function parseDuration(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const match = /^(\d+)\s*(d|h|m)$/i.exec(trimmed);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
  };
  return value * multipliers[unit];
}

/**
 * Resolve a session's `updatedAt` to a numeric timestamp (ms since epoch).
 * Returns `0` when the value is missing or unparseable.
 */
export function sessionUpdatedAtMs(session: SessionInfo): number {
  const { updatedAt } = session;
  if (updatedAt == null) return 0;
  const ms = new Date(updatedAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Select the ids of sessions that should be auto-archived given a threshold.
 *
 * A session is selected when:
 * - it is older than the threshold (now − updatedAt > threshold), and
 * - it is not currently open on this client (exempt from auto-archiving), and
 * - it is not already archived.
 *
 * When `thresholdMs` is `0` auto-archiving is disabled and an empty set is
 * returned.
 */
export function selectAutoArchiveIds(
  sessions: SessionInfo[],
  thresholdMs: number,
  now: number,
  openIds: Set<string>,
  archivedIds: Set<string>,
): Set<string> {
  const result = new Set<string>();
  if (thresholdMs <= 0) return result;
  for (const session of sessions) {
    const id = session.sessionId;
    if (openIds.has(id)) continue;
    if (archivedIds.has(id)) continue;
    const updatedAt = sessionUpdatedAtMs(session);
    if (updatedAt <= 0) continue;
    if (now - updatedAt > thresholdMs) {
      result.add(id);
    }
  }
  return result;
}
