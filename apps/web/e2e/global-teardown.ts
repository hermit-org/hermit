import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Playwright global teardown: stop the gateway launched in global-setup. The
 * launcher wrote its pid to `e2e/.gateway.json`; kill it and remove the file.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(HERE, ".gateway.json");

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(CONFIG_PATH)) return;
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { pid?: number };
    if (cfg.pid) {
      try {
        process.kill(cfg.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
  } finally {
    rmSync(CONFIG_PATH, { force: true });
  }
}
