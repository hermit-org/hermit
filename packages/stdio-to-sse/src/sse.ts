/**
 * Low-level Server-Sent Events (SSE) encoding and decoding utilities.
 *
 * The protocol used here is the standard W3C SSE format:
 *   data: <line 1>\n
 *   data: <line 2>\n
 *   \n
 *
 * Multi-line payloads are split so each line is prefixed with `data: `.
 * A blank line terminates the frame.
 *
 * In addition to the basic framing helpers, this module provides:
 *   - Heartbeat (comment) frame generation for proxy/connection stability.
 *   - JSON-RPC 2.0 line-delimited framing helpers that align with ACP/MCP
 *     stdio conventions.
 */

/** Optional metadata attached to an SSE frame. */
export interface SseFrameOptions {
  event?: string;
  id?: string;
  retry?: number;
}

/**
 * Encode a plain string payload into a complete SSE text frame.
 *
 * @param data    Payload to send.
 * @param options Optional event name, id, or retry timing.
 * @returns       The encoded SSE frame, ready to be written to a response stream.
 */
export function encodeSse(data: string, options?: SseFrameOptions): string {
  let frame = "";

  if (options?.id !== undefined) {
    frame += `id: ${options.id}\n`;
  }

  if (options?.event) {
    frame += `event: ${options.event}\n`;
  }

  if (options?.retry !== undefined) {
    frame += `retry: ${options.retry}\n`;
  }

  // SSE allows multi-line data by repeating the `data:` field.
  for (const line of data.split("\n")) {
    frame += `data: ${line}\n`;
  }

  // The empty line marks the end of the frame.
  frame += "\n";
  return frame;
}

/**
 * Encode a keep-alive SSE comment frame.
 *
 * Comment frames are ignored by EventSource consumers but keep the TCP
 * connection alive through proxies and load balancers that would otherwise
 * drop idle connections.
 */
export function encodeSseKeepAlive(comment = "keep-alive"): string {
  return `:${comment}\n\n`;
}

/** Result of parsing a raw SSE byte buffer. */
export interface ParsedSseFrames {
  /** Complete data payloads extracted from fully received frames. */
  data: string[];
  /** Unfinished trailing bytes that should be kept for the next parse call. */
  remainder: string;
}

/**
 * Parse a chunk of SSE text into complete frames.
 *
 * Handles both LF (`\n\n`) and CRLF (`\r\n\r\n`) frame terminators, comment
 * lines (which are ignored), and multi-line `data:` fields.
 *
 * @param buffer Raw SSE text received so far.
 * @returns      Parsed payloads plus any trailing bytes that do not yet form a complete frame.
 */
export function parseSse(buffer: string): ParsedSseFrames {
  const data: string[] = [];

  // Normalize CRLF to LF first, then split on blank lines.
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");
    const payload: string[] = [];

    for (const line of lines) {
      // Skip comment frames (lines starting with `:`).
      if (line.startsWith(":")) {
        continue;
      }
      if (line.startsWith("data: ")) {
        payload.push(line.slice(6));
      }
    }

    if (payload.length > 0) {
      data.push(payload.join("\n"));
    }
  }

  return { data, remainder };
}

/**
 * Split a raw byte/text stream buffer into JSON-RPC 2.0 messages using the
 * newline-delimited framing used by ACP/MCP over stdio.
 *
 * Multi-byte UTF-8 characters that are split across chunk boundaries are kept
 * in the remainder and completed on the next call. Pass the returned
 * `remainder` back as the next `buffer` argument together with the new chunk.
 */
export function parseJsonRpcLines(
  buffer: Uint8Array,
  textDecoder: TextDecoder,
): {
  messages: unknown[];
  remainder: Uint8Array;
} {
  // Scan for newline boundaries without decoding so that we can keep partial
  // multi-byte sequences intact.
  const lines: Uint8Array[] = [];
  let start = 0;

  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0a) {
      // \n
      const end = i > start && buffer[i - 1] === 0x0d ? i - 1 : i;
      if (end > start) {
        lines.push(buffer.subarray(start, end));
      }
      start = i + 1;
    }
  }

  const remainder = buffer.subarray(start);

  const messages: unknown[] = [];
  for (const line of lines) {
    const text = textDecoder.decode(line);
    if (!text.trim()) continue;
    try {
      messages.push(JSON.parse(text));
    } catch {
      // Discard malformed lines; this matches the line-delimited framing
      // expectation that each non-empty line is valid JSON.
    }
  }

  return { messages, remainder };
}

/**
 * Encode a JSON-RPC 2.0 message into a single newline-terminated UTF-8 line.
 */
export function encodeJsonRpcLine(message: unknown): string {
  return `${JSON.stringify(message)}\n`;
}
