import { test, expect } from "@playwright/test";

/**
 * Routing / app-shell smoke tests for the new web UI.
 *
 * Routes:
 *   /                 → GatewayManager (landing)
 *   /g/:gatewayId     → RealApp chat for a gateway
 *   /settings         → settings page
 */

test.describe("routing", () => {
  test("/ renders the gateway manager", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Gateways").first()).toBeVisible();
    await expect(page.getByPlaceholder("Gateway name")).toBeVisible();
  });

  test("unknown path falls back to the gateway manager", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText("Gateways").first()).toBeVisible();
  });

  test("/settings renders the settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Settings").first()).toBeVisible();
    await expect(page.getByText("Appearance")).toBeVisible();
  });
});
