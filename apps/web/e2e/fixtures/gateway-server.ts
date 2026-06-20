/**
 * Standalone gateway launcher for live E2E tests.
 *
 * Spawns the real `kimi acp` agent behind a stdio↔SSE gateway (same transport
 * as `hermit start`) on a fixed port, using a FIXED test bearer token and an
 * in-memory token check — so it never touches the user's real
 * `~/.hermit/authorized-tokens.json`.
 *
 * Usage (spawned, detached, by the Playwright global setup):
 *   bun e2e/fixtures/gateway-server.ts <port>
 *
 * It writes `{ url, sendUrl, token, pid }` to `e2e/.gateway.json` once the HTTP
 * server is listening, prints "GATEWAY_READY" on stdout, and runs until killed.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import the real persistent gateway the CLI uses (packages/cli/src/lib/gateway.ts).
// It is self-contained (only node built-ins + @hermit/stdio-to-sse) and Bun
// resolves the workspace package from the monorepo root.
const { AcpGatewayServer } = await import(
  "../../../../packages/cli/src/lib/gateway.ts"
);

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] ?? 8787);
const TOKEN = "tok_e2e_fixed_test_token";

const server = new AcpGatewayServer({
  command: "kimi",
  args: ["acp"],
  port: PORT,
  hostname: "127.0.0.1",
  endpoint: "/",
  sendEndpoint: "/send",
  cors: true,
  heartbeatInterval: 30000,
  // Minimal in-memory bearer check (does NOT touch ~/.hermit).
  onRequest: (req, res) => {
    const auth = req.headers.authorization ?? "";
    const protectedPaths = ["/", "/send"];
    if (
      protectedPaths.includes(req.url ?? "") &&
      (req.method === "GET" || req.method === "POST")
    ) {
      if (auth !== `Bearer ${TOKEN}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
        return true;
      }
    }
    return false;
  },
});

const { stop } = await server.start();

const url = `http://127.0.0.1:${PORT}/`;
const sendUrl = `http://127.0.0.1:${PORT}/send`;
writeFileSync(
  resolve(HERE, "../.gateway.json"),
  JSON.stringify({ url, sendUrl, token: TOKEN, pid: process.pid }),
);

process.stdout.write("GATEWAY_READY\n");

// Keep alive until signalled.
const shutdown = async (sig: string) => {
  process.stderr.write(`gateway: received ${sig}, stopping\n`);
  await stop();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
