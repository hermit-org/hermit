import { spawn, type ChildProcess } from "node:child_process";
import { test, expect } from "@playwright/test";

/**
 * URL config auto-import. `hermit start` hands off connection config via query
 * params produced by `buildConfigUrl` (`src/config.ts`):
 *
 *   http://host/?name=…&url=…&sendUrl=…&token=…
 *
 * App.tsx reads it via `readConfigFromUrl`, imports the gateway, and drops the
 * user into the chat view for that gateway.
 *
 * IMPORTANT: these tests run against the PRODUCTION preview build (`vite preview`),
 * NOT the Vite dev server. The Vite dev server returns HTTP 403 for any request
 * carrying a `url=` query param (a deliberate security feature against
 * open-redirect/SSRF). That breaks `?url=…` in dev, but the CLI handoff URL is
 * consumed against a served build, so the preview build is the correct target.
 */

const PREVIEW_PORT = 5182;
const PREVIEW_BASE = `http://localhost:${PREVIEW_PORT}`;
const WEB_ROOT = import.meta.dirname + "/..";

let preview: ChildProcess | undefined;

test.beforeAll(async () => {
  // Build the app so the preview reflects current source. `tsc --noEmit` first
  // would surface type errors, but type-checking is the `build` script's job;
  // here we only need a deployable bundle.
  await run("bun", ["x", "vite", "build"], WEB_ROOT);

  preview = spawn(
    "bun",
    ["x", "vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"],
    { cwd: WEB_ROOT, stdio: "ignore", detached: true },
  );
  preview.unref();

  // Wait for the preview server to respond.
  await waitUntilOk(PREVIEW_BASE, 30_000);
});

test.afterAll(() => {
  if (preview && !preview.killed) {
    try {
      process.kill(-preview.pid!);
    } catch {
      preview.kill();
    }
  }
});

test("auto-imports a gateway from ?url & ?token and enters chat", async ({ page }) => {
  const url = encodeURIComponent("http://localhost:8787");
  const token = encodeURIComponent("autoimport_token");
  const name = encodeURIComponent("Auto Imported");

  await page.goto(`${PREVIEW_BASE}/?url=${url}&token=${token}&name=${name}`);

  // Redirected into the chat route for the new gateway.
  await expect(page).toHaveURL(/\/g\//);

  // The gateway persists; going back to the manager lists it.
  await page.goto(`${PREVIEW_BASE}/`);
  await expect(page.getByText("Auto Imported")).toBeVisible();
});

test("auto-import also works via ?payload deep link", async ({ page }) => {
  const payload = encodeURIComponent(
    JSON.stringify({
      url: "http://payload:5",
      token: "payload_token",
      name: "Payload GW",
    }),
  );
  await page.goto(`${PREVIEW_BASE}/?payload=${payload}`);

  await expect(page).toHaveURL(/\/g\//);
  await page.goto(`${PREVIEW_BASE}/`);
  await expect(page.getByText("Payload GW")).toBeVisible();
});

// --- helpers ---------------------------------------------------------------

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

async function waitUntilOk(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server ${base} did not become ready in ${timeoutMs}ms`);
}
