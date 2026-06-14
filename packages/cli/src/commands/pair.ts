import { Command } from "commander";
import { networkInterfaces } from "node:os";
import { createPendingPair } from "../lib/pairing";
import { loadConfig } from "../lib/config";
import { generateQrTerminal, encodeConnectionPayload } from "../lib/qr";
import type { ConnectionPayload } from "../lib/gateway";

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

  candidates.sort((a, b) => getInterfacePriority(a.name) - getInterfacePriority(b.name));

  return `http://${candidates[0].address}:${port}`;
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
