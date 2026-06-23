import { test, expect, describe } from "bun:test";
import type { SessionInfo } from "@hermit-org/acp";
import {
  parseDuration,
  sessionUpdatedAtMs,
  selectAutoArchiveIds,
} from "./archive";

function makeSession(
  sessionId: string,
  updatedAt: string | null,
): SessionInfo {
  return { sessionId, cwd: "/", updatedAt };
}

describe("parseDuration", () => {
  test("parses days", () => {
    expect(parseDuration("3d")).toBe(3 * 24 * 60 * 60 * 1000);
  });

  test("parses hours", () => {
    expect(parseDuration("2h")).toBe(2 * 60 * 60 * 1000);
  });

  test("parses minutes", () => {
    expect(parseDuration("30m")).toBe(30 * 60 * 1000);
  });

  test("is case-insensitive and trims whitespace", () => {
    expect(parseDuration(" 5D ")).toBe(5 * 24 * 60 * 60 * 1000);
  });

  test("returns 0 (disabled) for empty string", () => {
    expect(parseDuration("")).toBe(0);
  });

  test("returns 0 for malformed input", () => {
    expect(parseDuration("abc")).toBe(0);
    expect(parseDuration("3w")).toBe(0);
    expect(parseDuration("-1d")).toBe(0);
    expect(parseDuration("0d")).toBe(0);
  });
});

describe("sessionUpdatedAtMs", () => {
  test("parses an ISO string", () => {
    const ms = sessionUpdatedAtMs(makeSession("s1", "2024-01-01T00:00:00Z"));
    expect(ms).toBe(new Date("2024-01-01T00:00:00Z").getTime());
  });

  test("returns 0 when updatedAt is null", () => {
    expect(sessionUpdatedAtMs(makeSession("s1", null))).toBe(0);
  });
});

describe("selectAutoArchiveIds", () => {
  const NOW = new Date("2024-06-01T00:00:00Z").getTime();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

  test("selects stale, non-open, non-archived sessions", () => {
    const sessions = [
      makeSession("old", new Date(NOW - THREE_DAYS - 1).toISOString()),
      makeSession("fresh", new Date(NOW - 1000).toISOString()),
      makeSession("open", new Date(NOW - THREE_DAYS - 1).toISOString()),
      makeSession("already-archived", new Date(NOW - THREE_DAYS - 1).toISOString()),
    ];
    const result = selectAutoArchiveIds(
      sessions,
      THREE_DAYS,
      NOW,
      new Set(["open"]),
      new Set(["already-archived"]),
    );
    expect([...result]).toEqual(["old"]);
  });

  test("disabled when threshold is 0", () => {
    const sessions = [
      makeSession("old", new Date(NOW - THREE_DAYS - 1).toISOString()),
    ];
    const result = selectAutoArchiveIds(sessions, 0, NOW, new Set(), new Set());
    expect(result.size).toBe(0);
  });

  test("exempts open sessions even when stale", () => {
    const sessions = [
      makeSession("open-stale", new Date(NOW - THREE_DAYS - 1).toISOString()),
    ];
    const result = selectAutoArchiveIds(
      sessions,
      THREE_DAYS,
      NOW,
      new Set(["open-stale"]),
      new Set(),
    );
    expect(result.size).toBe(0);
  });

  test("skips sessions without a valid updatedAt", () => {
    const sessions = [
      makeSession("no-date", null),
      makeSession("old", new Date(NOW - THREE_DAYS - 1).toISOString()),
    ];
    const result = selectAutoArchiveIds(sessions, THREE_DAYS, NOW, new Set(), new Set());
    expect([...result]).toEqual(["old"]);
  });
});
