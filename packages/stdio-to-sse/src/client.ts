import { parseSse } from "./sse";

/**
 * Configuration for `StdioSseClient`.
 */
export interface StdioSseClientOptions {
  /** URL of the stdio-to-sse HTTP endpoint. */
  url: string;
  /** Optional headers to send with the POST request. */
  headers?: Record<string, string>;
  /**
   * Maximum number of reconnection attempts when the stream drops unexpectedly
   * (default: `0`). Each `send()` call is independent; reconnection only
   * applies within a single call.
   */
  maxRetries?: number;
  /**
   * Initial backoff delay in milliseconds between retries (default: `1000`).
   * Delays double on each attempt up to `maxRetryDelay`.
   */
  retryDelay?: number;
  /** Maximum backoff delay in milliseconds (default: `30000`). */
  maxRetryDelay?: number;
}

/**
 * HTTP client that sends a request body to a stdio-to-sse server and yields
 * each SSE payload as it arrives.
 *
 * Like the server, this client is protocol-agnostic: it only understands the
 * SSE framing and returns the raw `data:` contents. It adds transport-level
 * resilience through optional retries with exponential backoff.
 */
export class StdioSseClient {
  constructor(private readonly options: StdioSseClientOptions) {}

  /**
   * Send input to the server and asynchronously yield each SSE payload.
   *
   * @param input Text to write to the child process stdin.
   * @yields Raw payloads received from the SSE stream.
   */
  async *send(input: string): AsyncGenerator<string> {
    const {
      url,
      headers = {},
      maxRetries = 0,
      retryDelay = 1000,
      maxRetryDelay = 30000,
    } = this.options;

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= maxRetries) {
      try {
        for await (const item of this.sendOnce(input, headers)) {
          yield item;
        }
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= maxRetries) break;

        const delay = Math.min(retryDelay * 2 ** attempt, maxRetryDelay);
        await sleep(delay);
        attempt++;
      }
    }

    throw lastError ?? new Error("SSE request failed");
  }

  private async *sendOnce(
    input: string,
    headers: Record<string, string>,
  ): AsyncGenerator<string> {
    const response = await fetch(this.options.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Accept: "text/event-stream",
        ...headers,
      },
      body: input,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HTTP error ${response.status}: ${text || response.statusText}`,
      );
    }

    // React Native's fetch polyfill does not expose a streaming response body,
    // and some environments may not have a global TextDecoder. Fall back to
    // reading the whole response as text and then parsing the SSE frames.
    if (!response.body || typeof TextDecoder === "undefined") {
      const text = await response.text();
      const { data } = parseSse(text);
      for (const item of data) {
        yield item;
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse complete frames and keep unfinished bytes for the next chunk.
        const { data, remainder } = parseSse(buffer);
        buffer = remainder;

        for (const item of data) {
          yield item;
        }
      }

      // Flush any trailing data after the stream ends.
      const { data } = parseSse(buffer);
      for (const item of data) {
        yield item;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
