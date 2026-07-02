#!/usr/bin/env bun
/**
 * Test gateway server for web E2E tests.
 *
 * Spawns the mock ACP agent and exposes it as an unauthenticated SSE gateway
 * on a fixed port. This lets the Playwright suite connect to a real ACP
 * runtime without requiring the full CLI auth flow.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ServerResponse, IncomingMessage } from "node:http";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { appendFileSync } from "node:fs";

const PORT = Number(process.env.HERMIT_E2E_GATEWAY_PORT || "8788");
const HOSTNAME = process.env.HERMIT_E2E_GATEWAY_HOST || "127.0.0.1";
const SSE_ENDPOINT = "/";
const SEND_ENDPOINT = "/send";
const LOG_FILE = "/tmp/hermit-e2e-gateway.log";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AGENT_PATH = join(__dirname, "mock-acp-agent.cjs");

const connections = new Set<ServerResponse>();
let proc: ChildProcessWithoutNullStreams | null = null;
let procExited = false;

function log(...args: (string | number | unknown)[]) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  try {
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // ignore
  }
}

interface SseFrameOptions {
  event?: string;
  comment?: string;
}

function encodeSse(payload: string, opts: SseFrameOptions = {}) {
  const event = opts.event ? `event: ${opts.event}\n` : "";
  const comment = opts.comment ? `: ${opts.comment}\n` : "";
  const data = payload
    .split("\n")
    .map((line) => `data: ${line}`)
    .join("\n");
  return `${event}${comment}${data}\n\n`;
}

function broadcast(payload: string, opts: SseFrameOptions = {}) {
  const frame = encodeSse(payload, opts);
  for (const res of connections) {
    if (!res.writableEnded) {
      res.write(frame);
    }
  }
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function spawnAgent() {
  log("Spawning agent:", AGENT_PATH);
  proc = spawn("node", [AGENT_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.once("error", (error) => {
    procExited = true;
    log("Agent spawn error:", error.message);
    broadcast(error.message, { event: "error" });
  });

  proc.once("exit", (code, signal) => {
    procExited = true;
    const message = signal
      ? `Agent process exited with signal ${signal}`
      : `Agent process exited with code ${code ?? "unknown"}`;
    log(message);
    broadcast(message, { event: "error" });
    closeAllConnections();
  });

  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
  rl.on("line", (line) => {
    broadcast(line);
  });
  rl.once("close", () => {
    closeAllConnections();
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf-8").trimEnd();
    if (!text) return;
    for (const line of text.split("\n")) {
      if (line.trim()) {
        broadcast(line.trim(), { event: "error" });
      }
    }
  });
}

function closeAllConnections() {
  for (const res of connections) {
    connections.delete(res);
    if (!res.writableEnded) {
      res.end();
    }
  }
}

function startHeartbeat(res: ServerResponse, intervalMs: number) {
  const id = setInterval(() => {
    if (!res.writableEnded) {
      res.write(encodeSse("", { comment: "keep-alive" }));
    }
  }, intervalMs);
  res.once("close", () => clearInterval(id));
}

async function handleSend(_req: IncomingMessage, res: ServerResponse, body: Buffer) {
  if (!proc || proc.killed || !proc.stdin || proc.stdin.destroyed) {
    setCorsHeaders(res);
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Agent process is not running" }));
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const canContinue = proc!.stdin.write(body, (error) => {
      if (error) {
        reject(error);
      } else {
        setCorsHeaders(res);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        resolve();
      }
    });
    if (!canContinue) {
      proc!.stdin.once("drain", () => {
        setCorsHeaders(res);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        resolve();
      });
    }
  });
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        if (req.method === "OPTIONS") {
          setCorsHeaders(res);
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method === "GET" && req.url === "/health") {
          setCorsHeaders(res);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (req.method === "GET" && req.url === "/api/config") {
          setCorsHeaders(res);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ agent: { cwd: "/" } }));
          return;
        }

        if ((req.method === "GET" || req.method === "POST") && req.url === SSE_ENDPOINT) {
          log("SSE connection from", req.headers.origin || "unknown");
          setCorsHeaders(res);
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          // Flush headers and keep the connection alive with an initial comment frame.
          res.write(encodeSse("", { comment: "init" }));
          connections.add(res);
          startHeartbeat(res, 30000);
          res.once("close", () => {
            log("SSE connection closed");
            connections.delete(res);
          });
          return;
        }

        if (req.method === "POST" && req.url === SEND_ENDPOINT) {
          const body = await readRequestBody(req);
          await handleSend(req, res, body);
          return;
        }

        setCorsHeaders(res);
        res.writeHead(404);
        res.end("Not Found");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!res.headersSent) {
          setCorsHeaders(res);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      }
    });

    server.once("error", reject);
    server.listen(PORT, HOSTNAME, () => {
      server.removeListener("error", reject);
      spawnAgent();
      const url = `http://${HOSTNAME}:${PORT}${SSE_ENDPOINT}`;
      const sendUrl = `http://${HOSTNAME}:${PORT}${SEND_ENDPOINT}`;
      log(`E2E gateway listening at ${url}`);
      log(`Send endpoint: ${sendUrl}`);
      log(`Agent: ${AGENT_PATH}`);

      process.once("SIGINT", async () => {
        log("Shutting down...");
        closeAllConnections();
        const agent = proc;
        if (agent && !procExited && !agent.killed) {
          agent.kill();
          await new Promise((r) => agent.once("exit", r));
        }
        server.close(() => process.exit(0));
      });

      resolve({ url, sendUrl });
    });
  });
}

startServer().catch((error) => {
  log("Failed to start E2E gateway:", error);
  process.exit(1);
});
