import { test, expect } from "@playwright/test";

/**
 * GatewayManager tests: add / edit / delete / connect and connection-string
 * import. Backed by the persisted Zustand store in `src/stores/gatewayStore.ts`.
 *
 * Playwright creates a fresh isolated browser context per test (empty
 * localStorage), so each test starts from the "No gateways" state.
 */

test.describe("manual add", () => {
  test("adds a gateway and lists it", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Name").fill("My Gateway");
    await page
      .getByPlaceholder("SSE URL (e.g. http://localhost:8787)")
      .fill("http://localhost:8787");
    await page.getByPlaceholder("Bearer token").fill("tok_123");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("My Gateway")).toBeVisible();
    await expect(page.getByText("http://localhost:8787")).toBeVisible();
  });

  test("requires name, URL and token", async ({ page }) => {
    await page.goto("/");

    // Click Add with an empty form.
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(
      page.getByText("Name, URL and token are required."),
    ).toBeVisible();
    // Empty state should still be present (nothing added).
    await expect(page.getByText("No gateways")).toBeVisible();
  });
});

test.describe("edit and delete", () => {
  test("edits then deletes a gateway", async ({ page }) => {
    await page.goto("/");

    // Create one.
    await page.getByPlaceholder("Name").fill("Original");
    await page.getByPlaceholder("SSE URL (e.g. http://localhost:8787)").fill("http://a:1");
    await page.getByPlaceholder("Bearer token").fill("tok");
    await page.getByRole("button", { name: "Add" }).click();

    // Edit it.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByPlaceholder("Name")).toHaveValue("Original");
    await page.getByPlaceholder("Name").fill("Renamed");
    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByText("Renamed")).toBeVisible();
    await expect(page.getByText("Original")).toHaveCount(0);

    // Delete it (accept the window.confirm dialog).
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No gateways")).toBeVisible();
  });

  test("cancel edit resets the form", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Name").fill("G");
    await page.getByPlaceholder("SSE URL (e.g. http://localhost:8787)").fill("http://b:2");
    await page.getByPlaceholder("Bearer token").fill("tok");
    await page.getByRole("button", { name: "Add" }).click();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder("Name")).toHaveValue("");
  });
});

test.describe("connection-string import", () => {
  test("imports from raw JSON", async ({ page }) => {
    await page.goto("/");

    const json = JSON.stringify({
      url: "http://localhost:9999",
      token: "imp_tok",
      name: "Imported One",
    });
    await page.getByPlaceholder("Paste hermit://… or JSON").fill(json);
    await page.getByRole("button", { name: "Import" }).click();

    await expect(page.getByText("Imported One")).toBeVisible();
    await expect(page.getByText("Gateway imported.")).toBeVisible();
  });

  test("imports from a hermit:// deep link", async ({ page }) => {
    await page.goto("/");

    const payload = encodeURIComponent(
      JSON.stringify({ url: "http://deep:7", token: "deep_tok", name: "Deep Link GW" }),
    );
    await page
      .getByPlaceholder("Paste hermit://… or JSON")
      .fill(`hermit://connect?payload=${payload}`);
    await page.getByRole("button", { name: "Import" }).click();

    await expect(page.getByText("Deep Link GW")).toBeVisible();
  });

  test("rejects an invalid connection string", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Paste hermit://… or JSON").fill("not-valid-json");
    await page.getByRole("button", { name: "Import" }).click();

    await expect(page.getByText("Invalid connection string.")).toBeVisible();
  });
});

test.describe("connect", () => {
  test("connecting navigates to the chat view", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Name").fill("Connectable");
    await page.getByPlaceholder("SSE URL (e.g. http://localhost:8787)").fill("http://c:3");
    await page.getByPlaceholder("Bearer token").fill("tok");
    await page.getByRole("button", { name: "Add" }).click();

    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page).toHaveURL(/\/g\//);
  });
});
