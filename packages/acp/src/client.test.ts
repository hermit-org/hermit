import { describe, test, expect } from "bun:test";
import {
  createAcpClient,
  type StdioTransport,
  PROTOCOL_VERSION,
  AcpMethod,
  AcpNotification,
} from "./index";

/**
 * In-process transport with an explicit queue of inbound lines and a single
 * pending-reader promise. This mirrors how a real stdout stream behaves.
 */
function makeMockTransport() {
  const sent: string[] = [];
  const queue: string[] = [];
  let pending: ((value: string | undefined) => void) | null = null;
  let done = false;

  const transport: StdioTransport = {
    stdout: {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<string>> {
            if (queue.length > 0) {
              return { value: queue.shift()!, done: false };
            }
            if (done) return { value: undefined, done: true };
            const value = await new Promise<string | undefined>((resolve) => {
              pending = resolve;
            });
            if (value === undefined) return { value: undefined, done: true };
            return { value, done: false };
          },
        } as AsyncIterator<string>;
      },
    },
    stdin: {
      async write(line: string): Promise<void> {
        sent.push(line);
      },
    },
    async connect(): Promise<void> {},
    disconnect(): void {
      done = true;
      if (pending) {
        pending(undefined);
        pending = null;
      }
    },
  };

  return {
    transport,
    sent,
    feed(line: string): void {
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve(line);
      } else {
        queue.push(line);
      }
    },
  };
}

function lastRequest(arr: string[]): { id: number; method: string; params?: unknown } {
  return JSON.parse(arr[arr.length - 1]);
}

describe("AcpClient", () => {
  test("initialize sends protocol version and stores the result", async () => {
    const mock = makeMockTransport();
    const client = createAcpClient({
      transport: mock.transport,
      clientInfo: { name: "test" },
    });

    const initPromise = client.initialize();
    // Let the writer flush the request line.
    await Promise.resolve();

    const req = lastRequest(mock.sent);
    expect(req.method).toBe(AcpMethod.Initialize);
    expect((req.params as { protocolVersion: number }).protocolVersion).toBe(
      PROTOCOL_VERSION,
    );

    mock.feed(
      JSON.stringify({
        jsonrpc: "2.0",
        id: req.id,
        result: { protocolVersion: 1, agentCapabilities: { loadSession: true } },
      }),
    );

    const result = await initPromise;
    expect(result.protocolVersion).toBe(1);
    expect(result.agentCapabilities?.loadSession).toBe(true);
    expect(client.initializeResult?.protocolVersion).toBe(1);

    client.disconnect();
  });

  test("session/update notifications are delivered to listeners", async () => {
    const mock = makeMockTransport();
    const client = createAcpClient({ transport: mock.transport });

    // initialize (feed a minimal response)
    const init = client.initialize();
    await Promise.resolve();
    mock.feed(
      JSON.stringify({
        jsonrpc: "2.0",
        id: lastRequest(mock.sent).id,
        result: { protocolVersion: 1 },
      }),
    );
    await init;

    const updates: string[] = [];
    client.onUpdate((u) => updates.push(u.sessionUpdate));

    mock.feed(
      JSON.stringify({
        jsonrpc: "2.0",
        method: AcpNotification.SessionUpdate,
        params: {
          sessionId: "s1",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "hi" },
          },
        },
      }),
    );
    // Allow the reader loop to process the line.
    await new Promise((r) => setTimeout(r, 10));

    expect(updates).toEqual(["agent_message_chunk"]);
    client.disconnect();
  });

  test("session/prompt returns the stop reason", async () => {
    const mock = makeMockTransport();
    const client = createAcpClient({ transport: mock.transport });

    const init = client.initialize();
    await Promise.resolve();
    mock.feed(
      JSON.stringify({
        jsonrpc: "2.0",
        id: lastRequest(mock.sent).id,
        result: { protocolVersion: 1 },
      }),
    );
    await init;

    const promptPromise = client.sessionPrompt({
      sessionId: "s1",
      prompt: [{ type: "text", text: "hello" }],
    });
    await Promise.resolve();

    const req = lastRequest(mock.sent);
    expect(req.method).toBe("session/prompt");

    mock.feed(
      JSON.stringify({
        jsonrpc: "2.0",
        id: req.id,
        result: { stopReason: "end_turn" },
      }),
    );

    const result = await promptPromise;
    expect(result.stopReason).toBe("end_turn");
    client.disconnect();
  });

  test("unknown agent->client request returns method-not-found error", async () => {
    const mock = makeMockTransport();
    const client = createAcpClient({ transport: mock.transport });

    const init = client.initialize();
    await Promise.resolve();
    mock.feed(
      JSON.stringify({
        jsonrpc: "2.0",
        id: lastRequest(mock.sent).id,
        result: { protocolVersion: 1 },
      }),
    );
    await init;

    mock.sent.length = 0;
    mock.feed(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "fs/read_text_file",
        params: { sessionId: "s1", path: "/x" },
      }),
    );
    await new Promise((r) => setTimeout(r, 10));

    const response = JSON.parse(mock.sent[0]);
    expect(response.error.code).toBe(-32601);
    client.disconnect();
  });
});
