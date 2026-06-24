import { describe, test, expect } from "bun:test";
import {
  normalizeCors,
  corsPreflightHeaders,
  corsOriginHeaders,
  type CorsConfig,
} from "./cors";

describe("normalizeCors", () => {
  test("undefined defaults to enabled with wildcard origin", () => {
    const result = normalizeCors(undefined);
    expect(result).toEqual({
      enabled: true,
      origins: ["*"],
      methods: ["GET", "POST", "OPTIONS"],
      headers: ["Content-Type", "Authorization"],
    });
  });

  test("true enables CORS with defaults", () => {
    const result = normalizeCors(true);
    expect(result.enabled).toBe(true);
    expect(result.origins).toEqual(["*"]);
  });

  test("false disables CORS entirely", () => {
    const result = normalizeCors(false);
    expect(result).toEqual({
      enabled: false,
      origins: [],
      methods: [],
      headers: [],
    });
  });

  test("object with origins only uses default methods/headers", () => {
    const result = normalizeCors({ origins: ["http://localhost:5180"] });
    expect(result).toEqual({
      enabled: true,
      origins: ["http://localhost:5180"],
      methods: ["GET", "POST", "OPTIONS"],
      headers: ["Content-Type", "Authorization"],
    });
  });

  test("object with all fields", () => {
    const config: CorsConfig = {
      origins: ["https://a.com", "https://b.com"],
      methods: ["GET"],
      headers: ["X-Custom"],
    };
    const result = normalizeCors(config);
    expect(result).toEqual({
      enabled: true,
      origins: ["https://a.com", "https://b.com"],
      methods: ["GET"],
      headers: ["X-Custom"],
    });
  });

  test("object with empty arrays falls back to defaults", () => {
    const result = normalizeCors({ origins: [], methods: [], headers: [] });
    expect(result.origins).toEqual(["*"]);
    expect(result.methods).toEqual(["GET", "POST", "OPTIONS"]);
    expect(result.headers).toEqual(["Content-Type", "Authorization"]);
  });

  test("returns copies, not references to defaults", () => {
    const a = normalizeCors(true);
    const b = normalizeCors(true);
    expect(a.origins).not.toBe(b.origins);
    a.origins.push("evil");
    expect(b.origins).toEqual(["*"]);
  });
});

describe("corsPreflightHeaders", () => {
  test("disabled returns empty object", () => {
    const cors = normalizeCors(false);
    expect(corsPreflightHeaders(cors, "http://localhost:5180")).toEqual({});
  });

  test("wildcard origin returns Access-Control-Allow-Origin: *", () => {
    const cors = normalizeCors(true);
    const headers = corsPreflightHeaders(cors);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization",
    );
    expect(headers["Vary"]).toBeUndefined();
  });

  test("specific origin echoes back matching request origin", () => {
    const cors = normalizeCors({ origins: ["http://localhost:5180"] });
    const headers = corsPreflightHeaders(cors, "http://localhost:5180");
    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5180");
    expect(headers["Vary"]).toBe("Origin");
  });

  test("specific origin returns empty when request origin not allowed", () => {
    const cors = normalizeCors({ origins: ["http://localhost:5180"] });
    const headers = corsPreflightHeaders(cors, "http://evil.com");
    expect(headers).toEqual({});
  });

  test("specific origin returns empty when no request origin", () => {
    const cors = normalizeCors({ origins: ["http://localhost:5180"] });
    const headers = corsPreflightHeaders(cors, undefined);
    expect(headers).toEqual({});
  });

  test("overrides customize methods and headers", () => {
    const cors = normalizeCors(true);
    const headers = corsPreflightHeaders(cors, undefined, {
      methods: ["GET", "OPTIONS"],
      headers: ["Content-Type"],
    });
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
  });
});

describe("corsOriginHeaders", () => {
  test("disabled returns empty object", () => {
    const cors = normalizeCors(false);
    expect(corsOriginHeaders(cors, "http://localhost:5180")).toEqual({});
  });

  test("wildcard returns only origin header", () => {
    const cors = normalizeCors(true);
    const headers = corsOriginHeaders(cors);
    expect(headers).toEqual({ "Access-Control-Allow-Origin": "*" });
  });

  test("specific origin echoes matching request origin with Vary", () => {
    const cors = normalizeCors({ origins: ["https://app.com"] });
    const headers = corsOriginHeaders(cors, "https://app.com");
    expect(headers).toEqual({
      "Access-Control-Allow-Origin": "https://app.com",
      Vary: "Origin",
    });
  });

  test("specific origin returns empty when not allowed", () => {
    const cors = normalizeCors({ origins: ["https://app.com"] });
    expect(corsOriginHeaders(cors, "https://evil.com")).toEqual({});
  });
});
