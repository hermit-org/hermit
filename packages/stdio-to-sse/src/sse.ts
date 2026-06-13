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
 * @param buffer Raw SSE text received so far.
 * @returns      Parsed payloads plus any trailing bytes that do not yet form a complete frame.
 */
export function parseSse(buffer: string): ParsedSseFrames {
  const data: string[] = [];

  // Frames are separated by a blank line ("\n\n").
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");
    const payload: string[] = [];

    for (const line of lines) {
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
