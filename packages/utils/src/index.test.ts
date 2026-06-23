import { describe, expect, test } from "bun:test";
import { clamp, formatId } from "./index";

describe("formatId", () => {
  test("prefixes the id with id_", () => {
    expect(formatId("user-123")).toBe("id_user-123");
  });

  test("handles empty strings", () => {
    expect(formatId("")).toBe("id_");
  });
});

describe("clamp", () => {
  test("returns the value when it is within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("clamps to the minimum", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  test("clamps to the maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  test("returns min when value equals min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  test("returns max when value equals max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
