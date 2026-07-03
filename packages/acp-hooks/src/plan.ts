import type { PlanEntry, PlanPriority, PlanStatus } from "@hermit-org/acp";

/**
 * ACP priority/enum → PlanPriority mapping for todo entries extracted from
 * tool_call rawInput. TodoList tools typically use "high"|"medium"|"low"
 * directly, so this is mostly a passthrough with a fallback.
 */
export function toPlanPriority(value: unknown): PlanPriority | undefined {
  if (value === "high" || value === "medium" || value === "low") return value;
  return undefined;
}

/**
 * Normalise todo status values emitted by different agents into the standard
 * ACP `PlanStatus` union. Some agents report completion as `"done"` rather
 * than the ACP-standard `"completed"`; we map common synonyms so the plan
 * bar renders correctly instead of falling back to pending.
 */
export function toPlanStatus(value: unknown): PlanStatus | undefined {
  if (
    value === "pending" ||
    value === "todo" ||
    value === "open" ||
    value === "not_started"
  ) {
    return "pending";
  }
  if (
    value === "in_progress" ||
    value === "doing" ||
    value === "active" ||
    value === "started"
  ) {
    return "in_progress";
  }
  if (
    value === "completed" ||
    value === "done" ||
    value === "finished" ||
    value === "closed"
  ) {
    return "completed";
  }
  return undefined;
}

/**
 * Best-effort extraction of PlanEntry[] from a tool_call's rawInput.
 *
 * Agents (e.g. Kimi Code) that manage their todos via a `TodoList` tool send
 * the full todo list as the tool's input payload rather than via a separate
 * `session/update` plan notification. This normalises the common shapes:
 *
 *   - `{ todos: [{ content / title, status, priority }] }`
 *   - `{ todos: [{ content / title, status }] }`
 *
 * Returns `null` when the payload doesn't look like a todo list, so the caller
 * can skip the plan sync.
 */
export function extractPlanFromToolInput(
  rawInput: unknown,
): PlanEntry[] | null {
  if (!rawInput || typeof rawInput !== "object") return null;
  const obj = rawInput as Record<string, unknown>;

  // Detect TodoList-style payloads: an array under `todos`.
  const todos = obj.todos;
  if (!Array.isArray(todos)) return null;

  const entries: PlanEntry[] = [];
  for (const item of todos) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const content =
      typeof t.content === "string"
        ? t.content
        : typeof t.title === "string"
          ? t.title
          : undefined;
    if (!content) continue;

    const status = t.status;
    const entry: PlanEntry = { content };
    const normalizedStatus = toPlanStatus(status);
    if (normalizedStatus) {
      entry.status = normalizedStatus;
    }
    const priority = toPlanPriority(t.priority);
    if (priority) entry.priority = priority;
    entries.push(entry);
  }
  return entries;
}

/**
 * Predicate: does this tool call carry a TodoList payload?
 * Used to hide TodoList tool calls from the chat transcript and side
 * panel — they are already rendered via the PlanBar above the composer.
 */
export function isTodoToolCall(call: { rawInput?: unknown }): boolean {
  return extractPlanFromToolInput(call.rawInput) !== null;
}
