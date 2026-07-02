import { test, expect } from "@playwright/test";
import { clearStorage, E2E_GATEWAY_URL, E2E_GATEWAY_TOKEN } from "./fixtures/helpers";

/**
 * Session chat flow: connect to the mock gateway, start a new session, send a
 * message, and verify both the user and assistant bubbles appear.
 */

test.describe("session chat", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("connects to the gateway and sends a message", async ({ page }) => {
    page.on("pageerror", (error) => {
      console.error("[browser pageerror]", error);
    });

    await page.goto("/");

    await expect(page.getByTestId("gateway-registration")).toBeVisible();

    await page.getByTestId("gateway-name-input").fill("E2E Gateway");
    await page.getByTestId("gateway-url-input").fill(E2E_GATEWAY_URL);
    await page.getByTestId("gateway-token-input").fill(E2E_GATEWAY_TOKEN);
    await page.getByTestId("gateway-connect-button").click();

    // The app redirects to the active gateway's chat view.
    await expect(page).toHaveURL(/\/g\//);
    await expect(page.getByTestId("acp-client-page")).toBeVisible();

    await expect(page.getByText("Connected").first()).toBeVisible({ timeout: 15000 });

    // Wait for the SSE handshake and the composer to become usable.
    const textarea = page.getByTestId("composer-textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();

    await textarea.fill("Hello from E2E");
    await page.getByTestId("composer-send-button").click();

    // The user message should appear immediately.
    await expect(
      page.locator('[data-testid="message-bubble"][data-message-role="user"]'),
    ).toContainText("Hello from E2E");

    // The mock agent echoes the prompt; wait for the assistant response.
    await expect(
      page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
    ).toContainText("Echo: Hello from E2E", { timeout: 15000 });
  });
});
