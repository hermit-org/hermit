import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

/**
 * Resolve the build version label:
 * - In CI (tag push), use `GITHUB_REF_NAME` (the tag, e.g. "v0.0.6-alpha.10").
 * - When HEAD is exactly on a git tag (local release build), use the tag.
 * - Otherwise (dev/branch build), use "<branch>@<short-sha>".
 */
function resolveVersion(): string {
  // GitHub Actions sets GITHUB_REF_NAME to the tag name on tag-push triggers.
  // This is more reliable than `git describe` which requires full history
  // (actions/checkout uses shallow clone by default).
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_TYPE === "tag") {
    return process.env.GITHUB_REF_NAME;
  }

  const run = (cmd: string): string =>
    execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();

  try {
    // git describe --exact-match only succeeds when HEAD is exactly on a tag.
    const tag = run("git describe --tags --exact-match HEAD");
    if (tag) return tag;
  } catch {
    // not on a tag → fall through
  }

  let branch = "unknown";
  let sha = "0000000";
  try {
    branch = run("git rev-parse --abbrev-ref HEAD");
    sha = run("git rev-parse --short HEAD");
  } catch {
    // git unavailable
  }
  return `${branch}@${sha}`;
}

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.BASE_URL || "/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(resolveVersion()),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5180,
  },
});
