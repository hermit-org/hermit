import { describe, expect, test } from "bun:test";
import {
  extractPlanFromToolInput,
  isTodoToolCall,
  toPlanPriority,
  toPlanStatus,
} from "./plan";

describe("toPlanStatus", () => {
  test("normalises completion synonyms to completed", () => {
    expect(toPlanStatus("completed")).toBe("completed");
    expect(toPlanStatus("done")).toBe("completed");
    expect(toPlanStatus("finished")).toBe("completed");
    expect(toPlanStatus("closed")).toBe("completed");
  });

  test("normalises in-progress synonyms", () => {
    expect(toPlanStatus("in_progress")).toBe("in_progress");
    expect(toPlanStatus("doing")).toBe("in_progress");
    expect(toPlanStatus("active")).toBe("in_progress");
    expect(toPlanStatus("started")).toBe("in_progress");
  });

  test("normalises pending synonyms", () => {
    expect(toPlanStatus("pending")).toBe("pending");
    expect(toPlanStatus("todo")).toBe("pending");
    expect(toPlanStatus("open")).toBe("pending");
    expect(toPlanStatus("not_started")).toBe("pending");
  });

  test("returns undefined for unknown values", () => {
    expect(toPlanStatus("cancelled")).toBeUndefined();
    expect(toPlanStatus(123)).toBeUndefined();
    expect(toPlanStatus(null)).toBeUndefined();
  });
});

describe("toPlanPriority", () => {
  test("passes through known priorities", () => {
    expect(toPlanPriority("high")).toBe("high");
    expect(toPlanPriority("medium")).toBe("medium");
    expect(toPlanPriority("low")).toBe("low");
  });

  test("returns undefined for unknown priorities", () => {
    expect(toPlanPriority("urgent")).toBeUndefined();
    expect(toPlanPriority(1)).toBeUndefined();
  });
});

describe("extractPlanFromToolInput", () => {
  test("extracts a todo list and normalises status", () => {
    const entries = extractPlanFromToolInput({
      todos: [
        { content: "Plan the work", status: "done" },
        { title: "Do the work", status: "in_progress" },
        { content: "Ship it", status: "pending" },
        { content: "Skipped", status: "unknown" },
      ],
    });

    expect(entries).toEqual([
      { content: "Plan the work", status: "completed" },
      { content: "Do the work", status: "in_progress" },
      { content: "Ship it", status: "pending" },
      { content: "Skipped" },
    ]);
  });

  test("ignores entries without content or title", () => {
    const entries = extractPlanFromToolInput({
      todos: [{ status: "done" }, { content: "Valid", status: "done" }],
    });
    expect(entries).toEqual([{ content: "Valid", status: "completed" }]);
  });

  test("returns null for non-todo payloads", () => {
    expect(extractPlanFromToolInput({})).toBeNull();
    expect(extractPlanFromToolInput({ items: [] })).toBeNull();
    expect(extractPlanFromToolInput(null)).toBeNull();
  });
});

describe("isTodoToolCall", () => {
  test("returns true when rawInput contains a todos array", () => {
    expect(isTodoToolCall({ rawInput: { todos: [{ content: "x" }] } })).toBe(
      true,
    );
  });

  test("returns false for non-todo tool calls", () => {
    expect(isTodoToolCall({ rawInput: { path: "/tmp" } })).toBe(false);
    expect(isTodoToolCall({})).toBe(false);
  });
});
