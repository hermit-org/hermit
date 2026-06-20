import { test, expect } from "@playwright/test";

/**
 * Legacy ServerListScreen (`src/screens/ServerListScreen.tsx`, route `/legacy`).
 *
 * Gateway add / edit / delete and connection-string import. Backed by the
 * persisted Zustand store (`src/stores/gatewayStore.ts`, localStorage). No live
 * gateway needed.
 *
 * Button/placeholder labels come from i18n (`src/i18n/locales/en.json`); the
 * default language is English (navigator.language → en).
 */

const NAME = "Gateway name";
const URL = "SSE URL (e.g. http://localhost:8787)";
const TOKEN = "Bearer token";
const PASTE = "Paste connection string";

test.describe("manual add", () => {
  test("adds a gateway and lists it", async ({ page }) => {
    await page.goto("/legacy");

    await page.getByPlaceholder(NAME).fill("My Gateway");
    await page.getByPlaceholder(URL).fill("http://localhost:8787");
    await page.getByPlaceholder(TOKEN).fill("tok_123");
    await page.getByRole("button", { name: "Add Gateway" }).click();

    await expect(page.getByText("My Gateway")).toBeVisible();
    await expect(page.getByText("http://localhost:8787")).toBeVisible();
  });

  test("empty form shows the empty-state notice and adds nothing", async ({ page }) => {
    await page.goto("/legacy");

    await page.getByRole("button", { name: "Add Gateway" }).click();

    // handleSave reuses t("gateways.empty") as the validation notice, which is
    // the same string as the empty-state copy — assert at least one is shown.
    await expect(
      page.getByText("No gateways. Add one or open a connection link."),
    ).toHaveCount(2);
  });
});

test.describe("edit and delete", () => {
  test("edits then deletes a gateway", async ({ page }) => {
    await page.goto("/legacy");

    await page.getByPlaceholder(NAME).fill("Original");
    await page.getByPlaceholder(URL).fill("http://a:1");
    await page.getByPlaceholder(TOKEN).fill("tok");
    await page.getByRole("button", { name: "Add Gateway" }).click();

    // Edit.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByPlaceholder(NAME)).toHaveValue("Original");
    await page.getByPlaceholder(NAME).fill("Renamed");
    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByText("Renamed")).toBeVisible();
    await expect(page.getByText("Original")).toHaveCount(0);

    // Delete (accept the window.confirm).
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Renamed")).toHaveCount(0);
  });

  test("cancel edit resets the form", async ({ page }) => {
    await page.goto("/legacy");

    await page.getByPlaceholder(NAME).fill("G");
    await page.getByPlaceholder(URL).fill("http://b:2");
    await page.getByPlaceholder(TOKEN).fill("tok");
    await page.getByRole("button", { name: "Add Gateway" }).click();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder(NAME)).toHaveValue("");
  });
});

test.describe("connection-string import", () => {
  test("imports from raw JSON", async ({ page }) => {
    await page.goto("/legacy");

    const json = JSON.stringify({
      url: "http://localhost:9999",
      token: "imp_tok",
      name: "Imported One",
    });
    await page.getByPlaceholder(PASTE).fill(json);
    await page.getByRole("button", { name: "Import" }).click();

    await expect(page.getByText("Imported One")).toBeVisible();
    await expect(page.getByText("Gateway imported")).toBeVisible();
  });

  test("imports from a hermit:// deep link", async ({ page }) => {
    await page.goto("/legacy");

    const payload = encodeURIComponent(
      JSON.stringify({ url: "http://deep:7", token: "deep_tok", name: "Deep Link GW" }),
    );
    await page.getByPlaceholder(PASTE).fill(`hermit://connect?payload=${payload}`);
    await page.getByRole("button", { name: "Import" }).click();

    await expect(page.getByText("Deep Link GW")).toBeVisible();
  });

  test("rejects an invalid connection string", async ({ page }) => {
    await page.goto("/legacy");

    await page.getByPlaceholder(PASTE).fill("not-valid-json");
    await page.getByRole("button", { name: "Import" }).click();

    await expect(page.getByText("Invalid connection string")).toBeVisible();
  });
});

test.describe("open", () => {
  test("clicking a gateway navigates to the session list", async ({ page }) => {
    await page.goto("/legacy");

    await page.getByPlaceholder(NAME).fill("Openable");
    await page.getByPlaceholder(URL).fill("http://c:3");
    await page.getByPlaceholder(TOKEN).fill("tok");
    await page.getByRole("button", { name: "Add Gateway" }).click();

    // Clicking the gateway row (the name text) opens it.
    await page.getByText("Openable").click();
    await expect(page).toHaveURL(/\/legacy\/g\//);
  });
});
