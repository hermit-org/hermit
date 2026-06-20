import { test, expect } from "@playwright/test";

/**
 * Routing / app-shell smoke tests for the LEGACY web UI (`src/screens/`).
 *
 * Routes (see `src/router.ts` + `App.tsx` LegacyRoute):
 *   /                                 → new-UI GatewayManager (landing)
 *   /legacy                           → ServerListScreen (legacy)
 *   /legacy/g/:gatewayId              → SessionListScreen (legacy)
 *   /legacy/g/:gatewayId/s/:sessionId → ChatScreen (legacy)
 *
 * Playwright gives each test a fresh isolated browser context, so the persisted
 * gateway/session stores start empty — no manual clearing needed.
 */

test.describe("routing", () => {
  test("?legacy param migrates to /legacy", async ({ page }) => {
    await page.goto("/?legacy");
    await expect(page).toHaveURL(/\/legacy$/);
    // Legacy shell header brand (i18n "title").
    await expect(page.getByText("Hermit Web").first()).toBeVisible();
  });

  test("/legacy renders the legacy ServerListScreen", async ({ page }) => {
    await page.goto("/legacy");
    // ServerListScreen empty-state copy (i18n gateways.empty).
    await expect(
      page.getByText("No gateways. Add one or open a connection link."),
    ).toBeVisible();
    // The add/import controls.
    await expect(page.getByPlaceholder("Gateway name")).toBeVisible();
    await expect(page.getByPlaceholder("Paste connection string")).toBeVisible();
  });

  test("unknown path falls back to the legacy shell without crashing", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText("Hermit Web").first()).toBeVisible();
    await expect(
      page.getByText("No gateways. Add one or open a connection link."),
    ).toBeVisible();
  });

  test("header language toggle switches i18n (中/EN)", async ({ page }) => {
    await page.goto("/legacy");
    // Add button label is English by default (navigator.language → en).
    await expect(page.getByRole("button", { name: "Add Gateway" })).toBeVisible();

    // Toggle to Chinese.
    await page.getByRole("button", { name: "中" }).click();
    await expect(page.getByRole("button", { name: "添加网关" })).toBeVisible();

    // Toggle back to English.
    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.getByRole("button", { name: "Add Gateway" })).toBeVisible();
  });
});
