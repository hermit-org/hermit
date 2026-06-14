import { Command } from "commander";
import { AcpGatewayServer, type ConnectionPayload } from "../../lib/gateway";
import { loadConfig, type HermitConfig } from "../../lib/config";
import {
  validatePairingCode,
  isTokenAuthorized,
  generateToken,
  authorizeToken,
} from "../../lib/pairing";
import { generateQrTerminal, encodeConnectionPayload } from "../../lib/qr";
import type { IncomingMessage, ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";

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

function getLanAddress(port: number): string {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const iface of entries ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return `http://${iface.address}:${port}`;
      }
    }
  }
  return `http://localhost:${port}`;
}

async function startServer(config: HermitConfig): Promise<void> {
  const { agent, gateway } = config;

  const sseEndpoint = gateway!.endpoint || "/";
  const sendEndpoint = sseEndpoint === "/" ? "/send" : `${sseEndpoint}/send`;
  const port = gateway!.port ?? 8787;

  // Create a persistent bearer token for QR/auto-connect.
  const token = generateToken();
  await authorizeToken(token);

  const server = new AcpGatewayServer({
    command: agent!.command,
    args: agent!.args,
    port,
    hostname: gateway!.hostname,
    endpoint: sseEndpoint,
    sendEndpoint,
    cors: gateway!.cors,
    heartbeatInterval: gateway!.heartbeatInterval,
    getQrPayload: (): ConnectionPayload => {
      const url = getLanAddress(port) + sseEndpoint;
      const sendUrl = getLanAddress(port) + sendEndpoint;
      return { url, sendUrl, token };
    },
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
  const qrPayload: ConnectionPayload = {
    url: getLanAddress(port) + sseEndpoint,
    sendUrl: getLanAddress(port) + sendEndpoint,
    token,
  };

  console.log(`Hermit gateway listening at ${url}`);
  console.log(`Send endpoint: ${sendEndpoint}`);
  console.log(`Agent: ${agent!.command} ${(agent!.args ?? []).join(" ")}`);
  console.log("\nScan the QR code with Hermit mobile app to connect:");
  console.log(await generateQrTerminal(qrPayload));
  console.log("\nOr paste this connection string:");
  console.log(encodeConnectionPayload(qrPayload));
  console.log("\nPress Ctrl+C to stop");

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
