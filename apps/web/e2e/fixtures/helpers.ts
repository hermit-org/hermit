/**
 * Shared E2E helpers and constants.
 */

import type { Page } from "@playwright/test";

/** URL of the mock ACP gateway started by Playwright's webServer. */
export const E2E_GATEWAY_URL = "http://localhost:8788/";

/** Token expected by the mock gateway (the fixture does not enforce auth). */
export const E2E_GATEWAY_TOKEN = "e2e-token";

/** Clear persisted stores so each test starts with no configured gateways. */
export async function clearStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
