import { test, expect } from "@playwright/test";

/**
 * Legacy ChatScreen (`src/screens/ChatScreen.tsx`,
 * route `/legacy/g/:gatewayId/s/:sessionId`).
 *
 * Without a live gateway the ACP client can't connect, so this spec covers the
 * chat SHELL: rendering, the disconnected state ("Reconnect"), a disabled Send
 * button, back-navigation, and the "gateway not found" fallback. Full streaming
 * (send → assistant reply → tool calls) needs a running gateway + agent and is
 * out of scope here.
 */

async function enterChat(page: import("@playwright/test").Page) {
  await page.goto("/legacy");
  await page.getByPlaceholder("Gateway name").fill("Chat GW");
  await page.getByPlaceholder("SSE URL (e.g. http://localhost:8787)").fill("http://localhost:8787");
  await page.getByPlaceholder("Bearer token").fill("tok");
  await page.getByRole("button", { name: "Add Gateway" }).click();
  await page.getByText("Chat GW").click();
  await page.getByRole("button", { name: /New Session/ }).click();
  await expect(page).toHaveURL(/\/legacy\/g\/.+\/s\//);
}

test.describe("chat shell (no live gateway)", () => {
  test("renders the composer and message placeholder", async ({ page }) => {
    await enterChat(page);

    await expect(page.getByPlaceholder("Message...")).toBeVisible();
  });

  test("shows Reconnect while disconnected and disables Send", async ({ page }) => {
    await enterChat(page);

    // !connected → a Reconnect button is shown.
    await expect(page.getByRole("button", { name: "Reconnect" })).toBeVisible();

    // canSend = connected && acpSessionId && input.trim(); without a connection
    // Send is disabled. The send button is exposed via its aria-label.
    const send = page.getByRole("button", { name: "Send" });
    await expect(send).toBeDisabled();

    // Typing still doesn't enable it (not connected).
    await page.getByPlaceholder("Message...").fill("hello");
    await expect(send).toBeDisabled();
  });

  test("back button returns to the session list", async ({ page }) => {
    await enterChat(page);

    await page.getByRole("button", { name: "‹", exact: true }).click();
    await expect(page).toHaveURL(/\/legacy\/g\/[^/]+$/);
  });

  test("chat for a non-existent gateway shows the not-found fallback", async ({ page }) => {
    // Navigate directly to a chat route whose gatewayId isn't in the store.
    await page.goto("/legacy/g/does-not-exist/s/whatever");

    await expect(page.getByText("Gateway not found.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  });
});
