import { Command } from "commander";
import { AcpGatewayServer } from "../../lib/gateway";
import { loadConfig, type HermitConfig } from "../../lib/config";
import {
  validatePairingCode,
  isTokenAuthorized,
} from "../../lib/pairing";
import type { IncomingMessage, ServerResponse } from "node:http";

function extractBearer(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return undefined;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  cors = true,
): void {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

async function startServer(config: HermitConfig): Promise<void> {
  const { agent, gateway } = config;

  const sseEndpoint = gateway!.endpoint || "/";
  const sendEndpoint = sseEndpoint === "/" ? "/send" : `${sseEndpoint}/send`;

  const server = new AcpGatewayServer({
    command: agent!.command,
    args: agent!.args,
    port: gateway!.port,
    hostname: gateway!.hostname,
    endpoint: sseEndpoint,
    sendEndpoint,
    cors: gateway!.cors,
    heartbeatInterval: gateway!.heartbeatInterval,
    onRequest: async (req, res) => {
      // CORS preflight for the pairing endpoint.
      if (gateway!.cors && req.method === "OPTIONS" && req.url === "/pair") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        });
        res.end();
        return true;
      }

      if (req.method === "POST" && req.url === "/pair") {
        const body = await readBody(req);
        const { code } = JSON.parse(body || "{}") as { code?: string };
        const token = code ? await validatePairingCode(code) : null;

        if (!token) {
          sendJson(res, 401, { ok: false, error: "Invalid or expired pairing code" });
          return true;
        }

        sendJson(res, 200, { ok: true, token });
        return true;
      }

      // Require a valid bearer token for the SSE and send endpoints.
      const protectedPaths = [sseEndpoint, sendEndpoint];
      if (protectedPaths.includes(req.url ?? "") && (req.method === "GET" || req.method === "POST")) {
        const token = extractBearer(req);
        if (!token || !(await isTokenAuthorized(token))) {
          sendJson(res, 401, { ok: false, error: "Unauthorized" });
          return true;
        }
        return false;
      }

      return false;
    },
  });

  const { url, stop } = await server.start();

  console.log(`Hermit gateway listening at ${url}`);
  console.log(`Send endpoint: ${sendEndpoint}`);
  console.log(`Agent: ${agent!.command} ${(agent!.args ?? []).join(" ")}`);
  console.log("Press Ctrl+C to stop");

  process.once("SIGINT", async () => {
    console.log("\nShutting down...");
    await stop();
    process.exit(0);
  });
}

async function startAction(): Promise<void> {
  const config = await loadConfig();
  await startServer(config);
}

export const command = new Command("start")
  .description("Start the Hermit gateway (ACP agent -> SSE)")
  .action(startAction);
