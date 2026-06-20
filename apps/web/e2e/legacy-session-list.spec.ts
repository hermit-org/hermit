import { test, expect } from "@playwright/test";

/**
 * Legacy SessionListScreen (`src/screens/SessionListScreen.tsx`,
 * route `/legacy/g/:gatewayId`).
 *
 * Local session create / delete and back-navigation. The agent-side session
 * list requires a live gateway (`session/list`); here we only exercise the
 * local-session behaviour, which works without a backend.
 *
 * Helper `addGatewayAndOpen` drives the ServerListScreen via the UI so the
 * gateway is persisted in the same isolated context the test uses.
 */

async function addGatewayAndOpen(page: import("@playwright/test").Page) {
  await page.goto("/legacy");
  await page.getByPlaceholder("Gateway name").fill("Test GW");
  await page.getByPlaceholder("SSE URL (e.g. http://localhost:8787)").fill("http://localhost:8787");
  await page.getByPlaceholder("Bearer token").fill("tok");
  await page.getByRole("button", { name: "Add Gateway" }).click();
  await page.getByText("Test GW").click();
  await expect(page).toHaveURL(/\/legacy\/g\//);
}

test.describe("session list", () => {
  test("shows the gateway name as title", async ({ page }) => {
    await addGatewayAndOpen(page);
    // The header shows the gateway name (falls back to "Sessions").
    await expect(page.getByText("Test GW").first()).toBeVisible();
  });

  test("New Session creates a local session and enters chat", async ({ page }) => {
    await addGatewayAndOpen(page);

    await page.getByRole("button", { name: /New Session/ }).click();
    // New local session is titled "New chat" (createSession default).
    await expect(page).toHaveURL(/\/legacy\/g\/.+\/s\//);
  });

  test("back button returns to the gateway list", async ({ page }) => {
    await addGatewayAndOpen(page);

    // Back chevron button.
    await page.getByRole("button", { name: "‹", exact: true }).click();
    await expect(page).toHaveURL(/\/legacy$/);
  });

  test("created session appears in the local list", async ({ page }) => {
    await addGatewayAndOpen(page);

    await page.getByRole("button", { name: /New Session/ }).click();
    await expect(page).toHaveURL(/\/s\//);

    // Go back to the session list; the new local session should be listed.
    await page.getByRole("button", { name: "‹", exact: true }).click();
    await expect(page.getByText("New chat")).toBeVisible();
  });

  test("delete a local session", async ({ page }) => {
    await addGatewayAndOpen(page);
    await page.getByRole("button", { name: /New Session/ }).click();
    await page.getByRole("button", { name: "‹", exact: true }).click();
    await expect(page.getByText("New chat")).toBeVisible();

    // The "×" delete button (deleteButton) for the local session row.
    await page.getByRole("button", { name: "×", exact: true }).click();
    await expect(page.getByText("New chat")).toHaveCount(0);
  });
});
