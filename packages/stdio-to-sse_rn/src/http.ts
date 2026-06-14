/**
 * Minimal runtime-agnostic helper for sending client-to-server messages
 * over plain HTTP POST.
 *
 * In the ACP gateway model the server-to-client stream travels over SSE,
 * while client-to-server messages are sent as separate HTTP POST requests
 * (for example to `/send`).
 */
export interface SendMessageOptions {
  /** URL to POST to. */
  url: string;
  /** Request body. */
  body: string;
  /** Optional headers. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: `30000`). */
  timeout?: number;
}

/**
 * Send a message to the gateway's stdin endpoint.
 *
 * @throws When the HTTP response is not OK or the request times out.
 */
export async function sendMessage(options: SendMessageOptions): Promise<void> {
  const { url, body, headers = {}, timeout = 30000 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        ...headers,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP error ${response.status}: ${text || response.statusText}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
