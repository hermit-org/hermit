import { describe, test, expect } from "bun:test";
import { extractLines, parseJsonRpcMessages, encodeJsonRpcMessage } from "./framing";

describe("extractLines", () => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  test("splits complete lines and keeps remainder", () => {
    const buffer = encoder.encode("hello\nworld");
    const { lines, remainder } = extractLines(buffer, decoder);
    expect(lines).toEqual(["hello"]);
    expect(decoder.decode(remainder)).toBe("world");
  });

  test("handles CRLF terminators", () => {
    const buffer = encoder.encode("line1\r\nline2\r\n");
    const { lines, remainder } = extractLines(buffer, decoder);
    expect(lines).toEqual(["line1", "line2"]);
    expect(remainder.length).toBe(0);
  });

  test("preserves partial UTF-8 sequences in remainder", () => {
    // "中" encoded as UTF-8 is 0xE4 0xB8 0xAD. Keep only the first byte.
    const buffer = new Uint8Array([0xe4]);
    const { lines, remainder } = extractLines(buffer, decoder);
    expect(lines).toEqual([]);
    expect(remainder).toEqual(new Uint8Array([0xe4]));
  });
});

describe("parseJsonRpcMessages", () => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  test("parses JSON-RPC request lines", () => {
    const buffer = encoder.encode('{"jsonrpc":"2.0","id":1}\n{"jsonrpc":"2.0","id":2}\n');
    const { messages, remainder } = parseJsonRpcMessages(buffer, decoder);
    expect(messages).toEqual([
      { jsonrpc: "2.0", id: 1 },
      { jsonrpc: "2.0", id: 2 },
    ]);
    expect(remainder.length).toBe(0);
  });

  test("skips malformed lines", () => {
    const buffer = encoder.encode('{"jsonrpc":"2.0","id":1}\nnot-json\n{"jsonrpc":"2.0","id":2}\n');
    const { messages } = parseJsonRpcMessages(buffer, decoder);
    expect(messages).toEqual([
      { jsonrpc: "2.0", id: 1 },
      { jsonrpc: "2.0", id: 2 },
    ]);
  });
});

describe("encodeJsonRpcMessage", () => {
  const encoder = new TextEncoder();

  test("encodes a message with trailing newline", () => {
    const message = { jsonrpc: "2.0", id: 1 };
    const encoded = encodeJsonRpcMessage(message, encoder);
    expect(new TextDecoder().decode(encoded)).toBe('{"jsonrpc":"2.0","id":1}\n');
  });
});
