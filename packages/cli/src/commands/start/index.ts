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

// Virtual/Docker interfaces that should not be advertised to mobile clients.
const VIRTUAL_IFACE_PATTERNS = [
  /^docker/i,
  /^veth/i,
  /^br-/i,
  /^tun/i,
  /^tap/i,
  /^vmnet/i,
  /^vboxnet/i,
  /^hyper-v/i,
  /^lo$/i,
];

// Interfaces commonly used for Wi-Fi / Ethernet, ordered by preference.
const PREFERRED_IFACE_PATTERNS = [
  /^wlan/i,
  /^en[0-9]/i,
  /^eth[0-9]/i,
  /^Wi-?Fi/i,
  /^Ethernet/i,
];

function isVirtualInterface(name: string): boolean {
  return VIRTUAL_IFACE_PATTERNS.some((pattern) => pattern.test(name));
}

function getInterfacePriority(name: string): number {
  for (let i = 0; i < PREFERRED_IFACE_PATTERNS.length; i++) {
    if (PREFERRED_IFACE_PATTERNS[i].test(name)) {
      return i;
    }
  }
  return PREFERRED_IFACE_PATTERNS.length;
}

function getLanAddress(port: number): string {
  const interfaces = networkInterfaces();
  const candidates: { name: string; address: string }[] = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    if (isVirtualInterface(name)) continue;
    for (const iface of entries ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }

  if (candidates.length === 0) {
    return `http://localhost:${port}`;
  }

  // Sort by preferred interface names (lower priority number = better).
  candidates.sort((a, b) => getInterfacePriority(a.name) - getInterfacePriority(b.name));

  return `http://${candidates[0].address}:${port}`;
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
