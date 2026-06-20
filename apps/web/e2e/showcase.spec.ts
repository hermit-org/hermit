import { test, expect } from "@playwright/test";

/**
 * Showcase page tests. The showcase renders the full ACP client layout using
 * MOCK_* data from `src/components/templates/mock-data.ts`, so it needs no live
 * gateway. This is the best target for structural smoke checks.
 *
 * Playwright creates a fresh isolated browser context per test (empty
 * localStorage), so no manual clearing is needed.
 */

test.describe("showcase", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/showcase");
  });

  test("renders the preview toolbar with all view tabs", async ({ page }) => {
    await expect(page.getByText("Atomic Design", { exact: false })).toBeVisible();
    // The toolbar exposes four views (ShowcasePage.tsx).
    for (const label of ["ACP Client", "Main Layout", "Split Layout", "Settings"]) {
      await expect(page.getByRole("button", { name: label }).first()).toBeVisible();
    }
  });

  test("ACP client view renders mock sessions, usage and cost", async ({ page }) => {
    // Default view is "client" (ACPClientPage) backed by MOCK_SESSIONS.
    await expect(page.getByText("Refactor parser module")).toBeVisible();
    await expect(page.getByText("Investigate SSE reconnect bug")).toBeVisible();

    // MOCK_USAGE: 48213 used tokens → "48.2k"; cost 0.142 USD → "$0.14".
    await expect(page.getByText("48.2k")).toBeVisible();
    await expect(page.getByText("$0.14")).toBeVisible();
  });
});
