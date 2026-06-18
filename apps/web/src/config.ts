/**
 * Connection configuration sources for the web client.
 *
 * A gateway can be configured three ways, in priority order:
 *   1. URL query/hash params (e.g. `?url=...&token=...&name=...`)
 *   2. A pasted connection string (raw JSON or `hermit://connect?payload=...`)
 *   3. Manual entry in the gateway form
 *
 * The CLI `hermit start` reads `hermit.config.json`, generates a token, and
 * prints a ready-to-use web URL carrying these params (see source 1).
 */

export interface ConnectionConfig {
  url: string;
  sendUrl: string;
  token: string;
  name?: string;
}

function deriveSendUrl(sseUrl: string): string {
  try {
    const url = new URL(sseUrl);
    const path = url.pathname.replace(/\/$/, "");
    url.pathname = path ? `${path}/send` : "/send";
    return url.toString();
  } catch {
    return sseUrl.endsWith("/") ? `${sseUrl}send` : `${sseUrl}/send`;
  }
}

/**
 * Parse a connection string into a config.
 *
 * Accepts:
 *   - Raw JSON: `{"url":"...","token":"..."}`
 *   - Deep link: `hermit://connect?payload=<encoded JSON>`
 */
export function parseConnectionString(input: string): ConnectionConfig | null {
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const deepLinkMatch = trimmed.match(/^hermit:\/\/connect\?payload=(.+)$/);
    const json = deepLinkMatch ? decodeURIComponent(deepLinkMatch[1]) : trimmed;
    const parsed = JSON.parse(json) as Partial<ConnectionConfig>;

    if (!parsed.url || !parsed.token) return null;

    return {
      url: parsed.url,
      token: parsed.token,
      sendUrl: parsed.sendUrl || deriveSendUrl(parsed.url),
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

/**
 * Read connection config from the current page URL.
 *
 * Looks at both the query string and the hash so links like
 * `http://localhost:5180/?url=...&token=...` and
 * `http://localhost:5180/#url=...&token=...` both work.
 */
export function readConfigFromUrl(): ConnectionConfig | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(
    window.location.search.replace(/^\?/, "") +
      "&" +
      window.location.hash.replace(/^#/, ""),
  );

  const url = params.get("url");
  const token = params.get("token");
  const name = params.get("name");
  const payload = params.get("payload");

  if (payload) {
    const fromPayload = parseConnectionString(payload);
    if (fromPayload) return fromPayload;
  }

  if (!url || !token) return null;

  return {
    url,
    token,
    sendUrl: params.get("sendUrl") || deriveSendUrl(url),
    name: name ?? undefined,
  };
}

/**
 * Build a shareable web URL that carries connection config as params.
 */
export function buildConfigUrl(
  webBaseUrl: string,
  config: ConnectionConfig,
): string {
  const params = new URLSearchParams({
    name: config.name || "Hermit Gateway",
    url: config.url,
    sendUrl: config.sendUrl,
    token: config.token,
  });
  const base = webBaseUrl.replace(/[?#].*$/, "");
  return `${base}?${params.toString()}`;
}
