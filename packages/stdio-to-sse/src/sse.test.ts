import { describe, test, expect } from "bun:test";
import { encodeSse, parseSse } from "./sse";

describe("encodeSse", () => {
  test("encodes a single-line payload", () => {
    expect(encodeSse("hello")).toBe("data: hello\n\n");
  });

  test("encodes a multi-line payload", () => {
    expect(encodeSse("hello\nworld")).toBe("data: hello\ndata: world\n\n");
  });

  test("includes event name when provided", () => {
    expect(encodeSse("hello", { event: "message" })).toBe(
      "event: message\ndata: hello\n\n",
    );
  });

  test("includes id and retry when provided", () => {
    expect(encodeSse("hello", { id: "1", retry: 3000 })).toBe(
      "id: 1\nretry: 3000\ndata: hello\n\n",
    );
  });

  test("returns an empty data frame for an empty payload", () => {
    expect(encodeSse("")).toBe("data: \n\n");
  });
});

describe("parseSse", () => {
  test("parses a single complete frame", () => {
    const { data, remainder } = parseSse("data: hello\n\n");
    expect(data).toEqual(["hello"]);
    expect(remainder).toBe("");
  });

  test("parses multiple complete frames", () => {
    const { data, remainder } = parseSse(
      "data: hello\n\ndata: world\n\n",
    );
    expect(data).toEqual(["hello", "world"]);
    expect(remainder).toBe("");
  });

  test("keeps incomplete bytes in the remainder", () => {
    const { data, remainder } = parseSse("data: hello\n");
    expect(data).toEqual([]);
    expect(remainder).toBe("data: hello\n");
  });

  test("reconstructs multi-line payloads", () => {
    const { data, remainder } = parseSse(
      "data: line1\ndata: line2\n\n",
    );
    expect(data).toEqual(["line1\nline2"]);
    expect(remainder).toBe("");
  });

  test("ignores non-data fields", () => {
    const { data, remainder } = parseSse(
      "event: message\ndata: hello\n\n",
    );
    expect(data).toEqual(["hello"]);
    expect(remainder).toBe("");
  });

  test("parses an empty data field", () => {
    const { data, remainder } = parseSse("data: \n\n");
    expect(data).toEqual([""]);
    expect(remainder).toBe("");
  });

  test("parses complete and partial frames in the same buffer", () => {
    const { data, remainder } = parseSse(
      "data: hello\n\ndata: wor",
    );
    expect(data).toEqual(["hello"]);
    expect(remainder).toBe("data: wor");
  });

  test("handles reversed field order and extracts only data", () => {
    const { data, remainder } = parseSse(
      "id: 42\nevent: msg\ndata: hello\nretry: 3000\n\n",
    );
    expect(data).toEqual(["hello"]);
    expect(remainder).toBe("");
  });

  test("drops event, id, and retry fields from the payload", () => {
    const { data, remainder } = parseSse(
      "event: ping\nid: 7\nretry: 1000\ndata: payload\n\n",
    );
    expect(data).toEqual(["payload"]);
    expect(remainder).toBe("");
  });
});
