import type { StdioTransport } from "@hermit-org/acp";
import {
  WebSseConnection,
  type WebSseConnectionOptions,
  type WebSseEvent,
} from "./connection";

export interface WebTransportOptions extends WebSseConnectionOptions {
  /** URL of the gateway's stdin endpoint (e.g. `http://host/send`). */
  sendUrl: string;
  /** Optional headers applied to both SSE and POST requests. */
  headers?: Record<string, string>;
  /** Optional listener for transport connection/error events. */
  onEvent?: (event: WebSseEvent) => void;
}

/**
 * Create a `StdioTransport` backed by browser `fetch` streaming (SSE read)
 * and HTTP POST (stdin write).
 *
 * `EventSource` cannot set the `Authorization` header required by the gateway,
 * so the SSE side uses `fetch` with a streaming response body.
 */
export function createWebTransport(options: WebTransportOptions): StdioTransport {
  const { sendUrl, headers = {}, onEvent, ...connectionOptions } = options;

  const connection = new WebSseConnection({ ...connectionOptions, headers });

  if (onEvent) {
    connection.addEventListener(onEvent);
  }

  return {
    stdout: connection,
    async connect(): Promise<void> {
      await connection.connect();
    },
    disconnect(): void {
      connection.disconnect();
    },
    stdin: {
      async write(line: string): Promise<void> {
        const body = line.endsWith("\n") ? line : `${line}\n`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch(sendUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain", ...headers },
            body,
            signal: controller.signal,
          });

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(
              `HTTP error ${response.status}: ${text || response.statusText}`,
            );
          }
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
  };
}

export type {
  WebSseConnection,
  WebSseConnectionOptions,
  WebSseConnectionState,
  WebSseEvent,
} from "./connection";
