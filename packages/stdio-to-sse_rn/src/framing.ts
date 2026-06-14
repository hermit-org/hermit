/**
 * UTF-8 safe line-delimited JSON-RPC 2.0 framing utilities.
 *
 * These helpers are environment-agnostic: they operate on `Uint8Array` and
 * `TextDecoder` / `TextEncoder` globals, which are available in React Native
 * and modern browsers.
 */

const NEWLINE = 0x0a; // \n
const CARRIAGE_RETURN = 0x0d; // \r

/**
 * Split a byte buffer into complete newline-delimited UTF-8 lines, keeping
 * partial multi-byte sequences in the remainder for the next chunk.
 */
export function extractLines(
  buffer: Uint8Array,
  textDecoder: TextDecoder,
): {
  lines: string[];
  remainder: Uint8Array;
} {
  const lineBuffers: Uint8Array[] = [];
  let start = 0;

  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === NEWLINE) {
      const end =
        i > start && buffer[i - 1] === CARRIAGE_RETURN ? i - 1 : i;
      if (end > start) {
        lineBuffers.push(buffer.subarray(start, end));
      }
      start = i + 1;
    }
  }

  const remainder = buffer.subarray(start);
  const lines: string[] = [];

  for (const line of lineBuffers) {
    lines.push(textDecoder.decode(line));
  }

  return { lines, remainder };
}

/**
 * Parse a growing byte buffer into complete JSON-RPC 2.0 messages.
 *
 * Malformed lines are skipped so that one bad frame does not kill the stream.
 */
export function parseJsonRpcMessages(
  buffer: Uint8Array,
  textDecoder: TextDecoder,
): {
  messages: unknown[];
  remainder: Uint8Array;
} {
  const { lines, remainder } = extractLines(buffer, textDecoder);
  const messages: unknown[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed));
    } catch {
      // Ignore malformed JSON lines.
    }
  }

  return { messages, remainder };
}

/**
 * Encode a JSON-RPC 2.0 message into a single newline-terminated UTF-8 line.
 */
export function encodeJsonRpcMessage(
  message: unknown,
  textEncoder: TextEncoder,
): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(message)}\n`);
}
