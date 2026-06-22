/**
 * Type-safe extraction helpers for `ToolCallState.rawInput` / `rawOutput`.
 *
 * Per the ACP spec these fields are `unknown`. Real agents send either a JSON
 * object (per the documented examples) or a JSON string (some agents stream the
 * raw tool input). These helpers normalize both shapes and give components
 * predictable typed values to render.
 */

import type { ToolCallState } from "@/components/domain";

/** Coerce a raw value (string | object | other) into a plain JS object. */
export function asObject(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // fall through
      }
    }
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Read a string-valued field off a possibly-null object. */
export function getField(obj: Record<string, unknown> | null, key: string): string | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}

/** Read a string field, falling back to a list of candidate keys. */
export function firstString(
  obj: Record<string, unknown> | null,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = getField(obj, k);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** Read a number-valued field. */
export function getNumber(obj: Record<string, unknown> | null, key: string): number | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Extract the basename from a posix/posix-like path. */
export function basename(path: string): string {
  const clean = path.replace(/[\\/]+$/, "");
  const idx = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

/** Extract the parent directory from a path (no trailing slash). */
export function dirname(path: string): string {
  const clean = path.replace(/[\\/]+$/, "");
  const idx = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  return idx >= 0 ? clean.slice(0, idx) : ".";
}

interface MatchEntry {
  path: string;
  line?: number;
  context?: string;
}

/** Parse a search `rawOutput.matches` array (or similar) into typed entries. */
export function extractMatches(value: unknown): MatchEntry[] {
  const obj = asObject(value);
  const raw = obj?.matches ?? obj?.results ?? obj?.items;
  if (!Array.isArray(raw)) return [];
  const out: MatchEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      out.push({ path: item });
      continue;
    }
    const m = asObject(item);
    if (!m) continue;
    const path = firstString(m, "path", "file", "file_path", "uri");
    if (!path) continue;
    out.push({
      path,
      line: getNumber(m, "line"),
      context: firstString(m, "context", "text", "preview", "snippet"),
    });
  }
  return out;
}

interface DeletedPaths {
  /** Flat list of deleted paths (preferred, from rawOutput.deleted). */
  paths: string[];
}

/** Extract a list of deleted paths from common rawOutput shapes. */
export function extractDeletedPaths(call: ToolCallState): DeletedPaths {
  const obj = asObject(call.rawOutput);
  const candidates: unknown[] = [];
  for (const key of ["deleted", "paths", "files", "removed"]) {
    const v = obj?.[key];
    if (Array.isArray(v)) candidates.push(...v);
  }
  // Some agents echo the deleted path in rawInput.path instead.
  const inObj = asObject(call.rawInput);
  const inputPath = firstString(inObj, "path", "file");
  if (inputPath) candidates.push(inputPath);

  // Locations carry the affected path too.
  for (const loc of call.locations) candidates.push(loc.path);

  const paths = candidates
    .map((c) => (typeof c === "string" ? c : firstString(asObject(c), "path", "file")))
    .filter((p): p is string => !!p && p.length > 0);

  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of paths) {
    if (seen.has(p)) continue;
    seen.add(p);
    unique.push(p);
  }
  return { paths: unique };
}

interface MovePaths {
  source?: string;
  target?: string;
}

/** Extract source/target from rawOutput, rawInput, or location pairs. */
export function extractMovePaths(call: ToolCallState): MovePaths {
  const outObj = asObject(call.rawOutput);
  const inObj = asObject(call.rawInput);
  const source =
    firstString(outObj, "source", "from", "src") ??
    firstString(inObj, "source", "from", "src", "oldPath", "sourcePath");
  const target =
    firstString(outObj, "target", "to", "destination", "dest") ??
    firstString(inObj, "target", "to", "destination", "dest", "newPath", "destinationPath");
  if (source || target) return { source, target };
  // Fall back to the first two locations (source then target).
  const locs = call.locations;
  if (locs.length >= 2) return { source: locs[0].path, target: locs[1].path };
  if (locs.length === 1) return { source: locs[0].path };
  return {};
}

/** Pretty-print an unknown raw value for the "raw" debug blocks. */
export function renderRaw(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        // fall through to verbatim
      }
    }
    return value;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return null;
    }
  }
  return String(value);
}
