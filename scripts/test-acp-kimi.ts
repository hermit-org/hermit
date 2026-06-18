import { createAcpClient, type StdioTransport, type SessionUpdate } from "../packages/acp/src";

const BASE = "http://localhost:8787";
const TOKEN = "tok_8f24dfdd0f72fe9ab9840319da676332408b947f27f10aa5";

// A fetch-based transport that works in Node 18+/Bun: reads the persistent
// SSE stream (with Authorization header) and POSTs to /send.
function makeTransport(url: string, sendUrl: string, token: string): StdioTransport {
  const headers = { Authorization: `Bearer ${token}` };
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let aborted = false;

  return {
    async connect() {
      // Kick off the SSE GET; reading happens lazily via the async iterator.
    },
    disconnect() {
      aborted = true;
      reader?.cancel().catch(() => {});
    },
    stdout: {
      [Symbol.asyncIterator]() {
        const decoder = new TextDecoder();
        let buffer = "";
        return {
          async next(): Promise<IteratorResult<string>> {
            if (!reader) {
              const res = await fetch(url, {
                headers: { Accept: "text/event-stream", ...headers },
              });
              if (!res.ok || !res.body) {
                throw new Error(`SSE connect failed: ${res.status}`);
              }
              reader = res.body.getReader();
            }
            while (true) {
              if (aborted) return { value: undefined, done: true };
              const { done, value } = await reader.read();
              if (done) return { value: undefined, done: true };
              buffer += decoder.decode(value, { stream: true });
              const frames = buffer.split("\n\n");
              buffer = frames.pop() ?? "";
              for (const frame of frames) {
                const data: string[] = [];
                for (const line of frame.split("\n")) {
                  if (line.startsWith(":")) continue;
                  if (line.startsWith("data: ")) data.push(line.slice(6));
                }
                if (data.length) {
                  const payload = data.join("\n");
                  for (const ln of payload.split("\n")) {
                    if (ln.length) return { value: ln, done: false };
                  }
                }
              }
            }
          },
        } as AsyncIterator<string>;
      },
    },
    stdin: {
      async write(line: string) {
        const body = line.endsWith("\n") ? line : `${line}\n`;
        const res = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain", ...headers },
          body,
        });
        if (!res.ok) throw new Error(`send failed: ${res.status}`);
      },
    },
  };
}

async function main() {
  const transport = makeTransport(`${BASE}/`, `${BASE}/send`, TOKEN);
  const client = createAcpClient({
    transport,
    clientInfo: { name: "hermit-test", title: "Hermit Test", version: "0.0.1" },
    clientCapabilities: {},
  });

  const updates: SessionUpdate[] = [];
  client.onUpdate((u) => {
    updates.push(u);
    process.stdout.write(`  [update] ${u.sessionUpdate}\n`);
  });

  console.log("→ initialize");
  const init = await client.initialize();
  console.log(`  protocolVersion=${init.protocolVersion}`);
  console.log(`  agentInfo=${JSON.stringify(init.agentInfo)}`);
  console.log(`  capabilities=${JSON.stringify(init.agentCapabilities)}`);

  console.log("→ session/new");
  const session = await client.sessionNew({ cwd: process.cwd() });
  console.log(`  sessionId=${session.sessionId}`);
  console.log(`  modes=${JSON.stringify(session.modes)}`);

  console.log("→ session/prompt");
  const result = await client.sessionPrompt({
    sessionId: session.sessionId,
    prompt: [{ type: "text", text: "Say hello in one short sentence." }],
  });
  console.log(`  stopReason=${result.stopReason}`);

  const text = updates
    .filter((u): u is Extract<SessionUpdate, { sessionUpdate: "agent_message_chunk" }> => u.sessionUpdate === "agent_message_chunk")
    .map((u) => (u.content.type === "text" ? u.content.text : ""))
    .join("");
  const thoughts = updates
    .filter((u): u is Extract<SessionUpdate, { sessionUpdate: "agent_thought_chunk" }> => u.sessionUpdate === "agent_thought_chunk")
    .map((u) => (u.content.type === "text" ? u.content.text : ""))
    .join("");
  if (thoughts) console.log(`\n=== thoughts ===\n${thoughts}\n`);
  console.log(`\n=== assistant reply ===\n${text || "(no text)"}\n`);

  client.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
