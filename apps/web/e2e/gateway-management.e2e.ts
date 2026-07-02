import { test, expect } from "@playwright/test";
import { clearStorage } from "./fixtures/helpers";

/**
 * Gateway management flow: add a gateway from the settings page and verify it
 * appears in the list.
 */

test.describe("gateway management", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("adds a gateway and shows it in the list", async ({ page }) => {
    await page.goto("/settings");

    await page.getByTestId("settings-add-gateway-button").click();

    await page.getByTestId("settings-gateway-name-input").fill("E2E Gateway");
    await page.getByTestId("settings-gateway-url-input").fill("http://localhost:8788/");
    await page.getByTestId("settings-gateway-token-input").fill("e2e-token");
    await page.getByTestId("settings-gateway-save-button").click();

    await expect(page.getByTestId("settings-gateway-list")).toBeVisible();
    await expect(page.getByTestId("settings-gateway-item")).toHaveCount(1);
    await expect(page.getByTestId("settings-gateway-item-name")).toHaveText("E2E Gateway");
  });
});
