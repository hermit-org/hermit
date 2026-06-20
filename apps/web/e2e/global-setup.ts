import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Playwright global setup: start a REAL gateway running `kimi acp` (the agent
 * configured in hermit.config.json) on port 8787, so the legacy ChatScreen can
 * do a genuine initialize → session/new → session/prompt → streamed reply.
 *
 * The launcher (e2e/fixtures/gateway-server.ts) writes its connection config
 * (including its own pid) to `e2e/.gateway.json`; specs read it via
 * `getGatewayConfig()` and the teardown kills that pid.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(HERE, ".gateway.json");
const LAUNCHER = resolve(HERE, "fixtures/gateway-server.ts");
const PORT = 8787;

export default async function globalSetup(): Promise<void> {
  // Skip if kimi isn't installed (CI without the agent).
  const hasKimi = await new Promise<boolean>((r) =>
    spawn("sh", ["-c", "command -v kimi"]).on("exit", (c) => r(c === 0)),
  );
  if (!hasKimi) {
    console.warn("[global-setup] kimi not found — skipping live gateway.");
    writeFileSync(CONFIG_PATH, JSON.stringify({ skipped: true }));
    return;
  }

  const proc = spawn("bun", [LAUNCHER, String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout?.on("data", (d) => process.stdout.write(`[gateway] ${d}`));
  proc.stderr?.on("data", (d) => process.stderr.write(`[gateway] ${d}`));
  proc.on("exit", (code) => {
    if (!existsSync(CONFIG_PATH)) {
      console.warn(`[global-setup] gateway exited (code ${code}) before ready`);
    }
  });

  // Wait for the launcher to drop its config file.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      if (cfg.url || cfg.skipped) return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("gateway did not become ready in 60s");
}
