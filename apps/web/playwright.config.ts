import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the @hermit-org/web app.
 *
 * Run from apps/web:
 *   bunx playwright test          # headless
 *   bunx playwright test --headed # watch the browser
 *   bunx playwright test --ui      # interactive mode
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5180",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5180",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
