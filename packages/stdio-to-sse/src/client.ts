import { parseSse } from "./sse";

/**
 * Configuration for `StdioSseClient`.
 */
export interface StdioSseClientOptions {
  /** URL of the stdio-to-sse HTTP endpoint. */
  url: string;
}

/**
 * HTTP client that sends a request body to a stdio-to-sse server and yields
 * each SSE data payload as it arrives.
 *
 * Like the server, this client is protocol-agnostic: it only understands the
 * SSE framing and returns the raw `data:` contents.
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
    const response = await fetch(this.options.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Accept: "text/event-stream",
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
