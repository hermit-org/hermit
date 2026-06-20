import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the app shell: routing, the mode switcher, and the legacy
 * query-param migration. These exercise the custom path-based router in
 * `src/router.ts` without needing a live gateway backend.
 *
 * Note: Playwright creates a fresh isolated browser context per test, so
 * persisted localStorage starts empty — no manual clearing needed.
 */

/** Locator for the floating mode switcher (bottom-right). Scoped via its
 * unique "Legacy" button so it never collides with same-named showcase tabs.
 *
 * Note: the floating switcher is only rendered on full-screen routes
 * (gateways / real / showcase / settings). On /legacy it is absent — the
 * legacy shell has its own "New UI" button to return to the new UI. */
function modeSwitcher(page: import("@playwright/test").Page) {
  return page
    .getByRole("button", { name: "Legacy" })
    .locator("xpath=ancestor::div[1]");
}

test.describe("routing", () => {
  test("root renders the GatewayManager landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Gateways" })).toBeVisible();
    // Empty-state copy from the GatewayManager.
    await expect(
      page.getByText("Add a gateway above or import one from a connection string."),
    ).toBeVisible();
  });

  test("unknown path falls back to the legacy UI without crashing", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    // Unknown paths map to a not-found route, which is not full-screen, so the
    // legacy shell renders (brand "Hermit Web") with the legacy ServerListScreen.
    await expect(page.getByText("Hermit Web").first()).toBeVisible();
    await expect(
      page.getByText("No gateways. Add one or open a connection link."),
    ).toBeVisible();
  });
});

test.describe("query-param migration", () => {
  test("?legacy redirects to /legacy", async ({ page }) => {
    await page.goto("/?legacy");
    await expect(page).toHaveURL(/\/legacy$/);
    // Legacy header brand text comes from i18n "title".
    await expect(page.locator("header")).toBeVisible();
  });

  test("?showcase redirects to /showcase", async ({ page }) => {
    await page.goto("/?showcase");
    await expect(page).toHaveURL(/\/showcase$/);
    await expect(page.getByText("Atomic Design", { exact: false })).toBeVisible();
  });
});

test.describe("floating mode switcher", () => {
  test("navigates Gateways → Preview → Settings → Legacy", async ({ page }) => {
    await page.goto("/");

    await modeSwitcher(page).getByRole("button", { name: "Preview" }).click();
    await expect(page).toHaveURL(/\/showcase$/);

    // "Settings" also exists as a showcase view-tab; scope to the floating
    // switcher (anchored on the unique "Legacy" button) to disambiguate.
    await modeSwitcher(page).getByRole("button", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await modeSwitcher(page).getByRole("button", { name: "Legacy" }).click();
    await expect(page).toHaveURL(/\/legacy$/);

    // The floating switcher is not rendered on /legacy; the legacy shell's
    // "New UI" button returns to the new UI.
    await page.getByRole("button", { name: "New UI" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:5180\/$/);
  });
});
