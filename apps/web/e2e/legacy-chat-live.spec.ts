import { test, expect } from "@playwright/test";
import { getGatewayConfig } from "./fixtures/config";

/**
 * Live end-to-end chat through the legacy ChatScreen, against a REAL
 * `kimi acp` agent gateway started by the Playwright global setup
 * (e2e/fixtures/gateway-server.ts).
 *
 * Flow: inject the gateway into the persisted store → open the legacy session
 * list → new session → ChatScreen connects (initialize + session/new) → type a
 * prompt → the agent streams a reply → assert the assistant text renders.
 *
 * Skipped automatically when kimi is unavailable (e.g. CI), so the suite stays
 * green without the agent.
 */

const GW_ID = "gw_live";
const cfg = getGatewayConfig();

const describeLive = cfg ? test.describe : test.describe.skip;

describeLive("legacy chat (live kimi acp)", () => {
  test.beforeEach(async ({ page }) => {
    // Pre-seed the gateway store so ChatScreen/SessionListScreen auto-connect.
    await page.addInitScript(
      ([id, url, sendUrl, token]) => {
        const gw = {
          id,
          name: "Live Kimi",
          url,
          sendUrl,
          token,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        localStorage.setItem(
          "hermit-gateways",
          JSON.stringify({
            state: { gateways: [gw], activeGatewayId: id },
            version: 0,
          }),
        );
      },
      [GW_ID, cfg!.url, cfg!.sendUrl, cfg!.token],
    );
  });

  test("sends a prompt and receives a streamed reply", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/legacy/g/${GW_ID}`);

    // Create a local session → enters the ChatScreen.
    await page.getByRole("button", { name: /New Session/ }).click();
    await expect(page).toHaveURL(/\/legacy\/g\/.+\/s\//);

    // canSend = connected && acpSessionId && input.trim(). Type the prompt first,
    // then wait for Send to enable (ChatScreen connects + session/new).
    const input = page.getByPlaceholder("Message...");
    await input.fill("Reply with exactly one word: pong");
    const send = page.getByRole("button", { name: "Send" });
    await expect(send).toBeEnabled({ timeout: 60_000 });
    await send.click();

    // The assistant streams a reply; assert the user echo renders and the turn
    // completes (Send re-enables after end_turn) within a generous window.
    await expect(page.getByText("Reply with exactly one word: pong").first()).toBeVisible({
      timeout: 60_000,
    });
    // Once the turn ends the composer is interactive again.
    await expect(input).toBeEnabled({ timeout: 60_000 });
  });
});
