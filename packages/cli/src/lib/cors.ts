/**
 * CORS configuration for the Hermit gateway.
 *
 * - `true`  : allow all origins (default).
 * - `false` : disable CORS entirely.
 * - object  : fine-grained control over origins, methods, and headers.
 */
export type CorsConfig =
  | boolean
  | {
      /** Allowed origins. Use `["*"]` to allow any origin. Defaults to `["*"]`. */
      origins?: string[];
      /** Allowed methods for preflight responses. Defaults to GET, POST, OPTIONS. */
      methods?: string[];
      /** Allowed request headers for preflight responses. Defaults to Content-Type, Authorization. */
      headers?: string[];
    };

export interface NormalizedCors {
  enabled: boolean;
  origins: string[];
  methods: string[];
  headers: string[];
}

const DEFAULT_ORIGINS = ["*"];
const DEFAULT_METHODS = ["GET", "POST", "OPTIONS"];
const DEFAULT_HEADERS = ["Content-Type", "Authorization"];

/**
 * Normalize a `CorsConfig` into a fully-populated shape.
 */
export function normalizeCors(cors: CorsConfig | undefined): NormalizedCors {
  if (cors === false) {
    return { enabled: false, origins: [], methods: [], headers: [] };
  }

  if (cors === true || cors === undefined) {
    return {
      enabled: true,
      origins: [...DEFAULT_ORIGINS],
      methods: [...DEFAULT_METHODS],
      headers: [...DEFAULT_HEADERS],
    };
  }

  return {
    enabled: true,
    origins: cors.origins?.length ? [...cors.origins] : [...DEFAULT_ORIGINS],
    methods: cors.methods?.length ? [...cors.methods] : [...DEFAULT_METHODS],
    headers: cors.headers?.length ? [...cors.headers] : [...DEFAULT_HEADERS],
  };
}

/**
 * Resolve the allowed origin for a request.
 * Returns `null` when the request origin is not permitted.
 */
function resolveOrigin(allowed: string[], reqOrigin?: string): string | null {
  if (allowed.includes("*")) return "*";
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
  return null;
}

/**
 * Build CORS headers for a preflight (OPTIONS) response.
 *
 * Returns an empty object when CORS is disabled or the origin is not allowed;
 * the caller should decide whether to still send a 204 or reject the request.
 *
 * Pass `overrides` to customize the methods/headers advertised for a specific
 * endpoint while still respecting the configured origins.
 */
export function corsPreflightHeaders(
  cors: NormalizedCors,
  reqOrigin?: string,
  overrides?: { methods?: string[]; headers?: string[] },
): Record<string, string> {
  if (!cors.enabled) return {};

  const origin = resolveOrigin(cors.origins, reqOrigin);
  if (origin === null) return {};

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": (overrides?.methods ?? cors.methods).join(", "),
    "Access-Control-Allow-Headers": (overrides?.headers ?? cors.headers).join(", "),
  };
  if (origin !== "*") {
    headers["Vary"] = "Origin";
  }
  return headers;
}

/**
 * Build the `Access-Control-Allow-Origin` header for an actual response.
 *
 * Returns an empty object when CORS is disabled or the origin is not allowed.
 */
export function corsOriginHeaders(
  cors: NormalizedCors,
  reqOrigin?: string,
): Record<string, string> {
  if (!cors.enabled) return {};

  const origin = resolveOrigin(cors.origins, reqOrigin);
  if (origin === null) return {};

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
  };
  if (origin !== "*") {
    headers["Vary"] = "Origin";
  }
  return headers;
}
