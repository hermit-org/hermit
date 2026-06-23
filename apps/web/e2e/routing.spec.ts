import { test, expect } from "@playwright/test";

/**
 * Routing / app-shell smoke tests for the new web UI.
 *
 * Routes:
 *   /                 → smart landing (registration when no gateways,
 *                       otherwise redirects to the active gateway's chat)
 *   /g/:gatewayId     → RealApp chat for a gateway
 *   /settings         → settings page
 */

test.describe("routing", () => {
  test("/ renders the gateway registration when no gateways exist", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Connect to a gateway")).toBeVisible();
    await expect(page.getByPlaceholder("Hermit Gateway")).toBeVisible();
  });

  test("unknown path falls back to registration when no gateways exist", async ({
    page,
  }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText("Connect to a gateway")).toBeVisible();
  });

  test("/settings renders the settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Settings").first()).toBeVisible();
    // The gateways section is now the default landing section.
    await expect(page.getByText("Gateways").first()).toBeVisible();
  });
});
