import { RnSseConnection } from "./connection";
import { RnSseConnectionOptions, RnSseEvent } from "./types";
import { sendMessage, SendMessageOptions } from "./http";

/**
 * A stdio-like pair for React Native: a readable stdout stream (from SSE)
 * and a writable stdin sink (via HTTP POST to a gateway `/send` endpoint).
 */
export interface StdioLikeSse {
  /** Readable side: lines emitted by the remote process stdout. */
  stdout: AsyncIterable<string>;
  /** Writable side: sends a line to the remote process stdin. */
  stdin: {
    write(line: string): Promise<void>;
  };
  /** Underlying SSE transport. */
  connection: RnSseConnection;
  /** Subscribe to transport events. */
  addEventListener(listener: (event: RnSseEvent) => void): () => void;
}

/**
 * Options for `createStdioLikeSse`.
 */
export interface StdioLikeSseOptions extends RnSseConnectionOptions {
  /** URL of the gateway's stdin endpoint (e.g. `http://host/send`). */
  sendUrl: string;
  /** Optional headers for both SSE and POST requests. */
  headers?: Record<string, string>;
}

/**
 * Create a stdio-like abstraction over an SSE gateway.
 *
 * The returned object can be passed to an ACP JSON-RPC client that expects a
 * `{ stdin, stdout }` transport pair.
 */
export function createStdioLikeSse(options: StdioLikeSseOptions): StdioLikeSse {
  const { sendUrl, headers = {}, ...connectionOptions } = options;

  const connection = new RnSseConnection({
    ...connectionOptions,
    headers,
  });

  return {
    stdout: connection,
    stdin: {
      async write(line: string): Promise<void> {
        const body = line.endsWith("\n") ? line : `${line}\n`;
        const sendOptions: SendMessageOptions = {
          url: sendUrl,
          body,
          headers,
        };
        await sendMessage(sendOptions);
      },
    },
    connection,
    addEventListener: (listener) => connection.addEventListener(listener),
  };
}
