import { describe, expect, test } from "bun:test";
import {
  decodeConnectionPayload,
  encodeConnectionPayload,
} from "./qr";

describe("encodeConnectionPayload / decodeConnectionPayload", () => {
  test("round-trips a payload", () => {
    const payload = {
      url: "http://localhost:8787/",
      sendUrl: "http://localhost:8787/send",
      token: "tok_abc123",
    };
    const encoded = encodeConnectionPayload(payload);
    expect(decodeConnectionPayload(encoded)).toEqual(payload);
  });

  test("decodes a hermit://connect deep link", () => {
    const payload = {
      url: "http://localhost:8787/",
      sendUrl: "http://localhost:8787/send",
      token: "tok_abc123",
    };
    const encoded = encodeURIComponent(encodeConnectionPayload(payload));
    const deepLink = `hermit://connect?payload=${encoded}`;
    expect(decodeConnectionPayload(deepLink)).toEqual(payload);
  });

  test("trims whitespace before decoding", () => {
    const payload = { url: "", sendUrl: "", token: "" };
    const encoded = `  ${encodeConnectionPayload(payload)}  `;
    expect(decodeConnectionPayload(encoded)).toEqual(payload);
  });
});
