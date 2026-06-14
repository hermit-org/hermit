import { Command } from "commander";
import { networkInterfaces } from "node:os";
import { createPendingPair } from "../lib/pairing";
import { loadConfig } from "../lib/config";
import { generateQrTerminal, encodeConnectionPayload } from "../lib/qr";
import type { ConnectionPayload } from "../lib/gateway";

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

async function pairAction(): Promise<void> {
  const { code, token } = await createPendingPair();
  const config = await loadConfig();

  const sseEndpoint = config.gateway?.endpoint || "/";
  const sendEndpoint = sseEndpoint === "/" ? "/send" : `${sseEndpoint}/send`;
  const port = config.gateway?.port ?? 8787;

  const qrPayload: ConnectionPayload = {
    url: getLanAddress(port) + sseEndpoint,
    sendUrl: getLanAddress(port) + sendEndpoint,
    token,
  };

  console.log("Hermit pairing initiated.");
  console.log("");
  console.log(`Pairing code : ${code}`);
  console.log(`Bearer token : ${token}`);
  console.log("");
  console.log("Scan the QR code with Hermit mobile app to connect:");
  console.log(await generateQrTerminal(qrPayload));
  console.log("\nOr paste this connection string:");
  console.log(encodeConnectionPayload(qrPayload));
  console.log("");
  console.log(
    "Enter the pairing code in the Hermit mobile app to authorize this gateway.",
  );
  console.log("This code expires in 5 minutes.");
}

export const command = new Command("pair")
  .description("Generate a pairing code for a mobile client")
  .action(pairAction);
