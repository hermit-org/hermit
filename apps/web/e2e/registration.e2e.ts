import { test, expect } from "@playwright/test";

/**
 * Gateway registration flow E2E tests.
 */

test.describe("registration", () => {
  test("submits the gateway form and redirects to the chat view", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByPlaceholder("http://localhost:5174/sse").fill(
      "http://localhost:8787/",
    );
    await page.getByPlaceholder("pairing token").fill("test-token");
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page).toHaveURL(/\/g\/[a-zA-Z0-9_-]+/);
    await expect(page.getByText("Hermit Gateway").first()).toBeVisible();
    await expect(page.getByText("No sessions yet")).toBeVisible();
  });
});
