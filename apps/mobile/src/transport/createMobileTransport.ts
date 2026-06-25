/**
 * Mobile SSE transport adapter for `@hermit-org/acp`.
 *
 * Wraps `@hermit-org/stdio-to-sse_rn`'s `createStdioLikeSse` into the
 * `StdioTransport` interface expected by `createAcpClient`. The RN transport
 * handles SSE connection, HTTP POST sending, and automatic reconnection.
 */
import { createStdioLikeSse } from "@hermit-org/stdio-to-sse_rn";
import type { StdioTransport } from "@hermit-org/acp";
import type { Gateway } from "../types";

export function createMobileTransport(gateway: Gateway): StdioTransport {
  const headers: Record<string, string> = {};
  if (gateway.token) {
    headers.Authorization = `Bearer ${gateway.token}`;
  }

  const stdio = createStdioLikeSse({
    url: gateway.url,
    sendUrl: gateway.sendUrl,
    headers,
  });

  return {
    stdin: stdio.stdin,
    stdout: stdio.stdout,
    connect: () => stdio.connection.connect(),
    disconnect: () => stdio.connection.disconnect(),
  };
}
