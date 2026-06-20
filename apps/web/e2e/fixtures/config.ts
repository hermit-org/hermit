import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Read the live-gateway config written by the global setup
 * (e2e/.gateway.json). Returns `null` when the gateway was skipped (e.g. kimi
 * is not installed in CI) so live specs can no-op.
 *
 * Resolved relative to this file first, then `process.cwd()` as a fallback —
 * Playwright's TS loader can give `import.meta.url` a transformed path.
 */
export interface GatewayConfig {
  url: string;
  sendUrl: string;
  token: string;
}

function candidates(): string[] {
  const list: string[] = [];
  try {
    list.push(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".gateway.json"));
  } catch {
    /* ignore */
  }
  list.push(resolve(process.cwd(), "e2e", ".gateway.json"));
  return list;
}

export function getGatewayConfig(): GatewayConfig | null {
  for (const path of candidates()) {
    if (!existsSync(path)) continue;
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<GatewayConfig> & {
      skipped?: boolean;
    };
    if (raw.skipped) return null;
    if (raw.url && raw.token) {
      return { url: raw.url, sendUrl: raw.sendUrl ?? "", token: raw.token };
    }
  }
  return null;
}
