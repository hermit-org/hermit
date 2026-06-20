# Web E2E tests (Playwright)

End-to-end tests for the **legacy web UI** of `@hermit/web` (`apps/web`) — the
`src/screens/` UI served at `/legacy`, which is the web frontend in active use.
Driven by [Playwright](https://playwright.dev) with Chromium.

## What's covered

All routes are under `/legacy` (see `src/router.ts` + `App.tsx` LegacyRoute):

| Spec | Route | What it checks |
| --- | --- | --- |
| `routing.spec.ts` | `/legacy`, `/?legacy`, unknown paths | Route migration, the legacy shell, and the i18n language toggle (中/EN). |
| `legacy-server-list.spec.ts` | `/legacy` | `ServerListScreen`: add / edit / delete gateways and connection-string import (JSON + `hermit://` deep link). |
| `legacy-session-list.spec.ts` | `/legacy/g/:id` | `SessionListScreen`: create / list / delete local sessions, back-nav. |
| `legacy-chat.spec.ts` | `/legacy/g/:id/s/:id` | `ChatScreen` shell: composer, disconnected state ("Reconnect"), disabled Send, "gateway not found" fallback. |
| `legacy-chat-live.spec.ts` | `/legacy/g/:id/s/:id` | **Live** end-to-end: a real `kimi acp` gateway (auto-started) → send a prompt and receive a streamed assistant reply. |

Labels come from i18n (`src/i18n/locales/en.json`); the default language is
English (`navigator.language` → en).

## Not covered

Only the *agent-side* session list (vs. local sessions) and edge cases around
auth/login require a logged-in agent account; the live test relies on `kimi acp`
answering prompts without interactive login (which it does in this setup).

## Live chat (real `kimi acp`)

`legacy-chat-live.spec.ts` starts a real gateway running the configured agent
(`kimi acp`) via a Playwright `globalSetup` (`e2e/global-setup.ts` →
`e2e/fixtures/gateway-server.ts`), on port 8787, with a fixed in-memory bearer
token (it does NOT touch your `~/.hermit/`). The spec injects that gateway into
the persisted store, opens the legacy ChatScreen, sends a prompt, and asserts
the assistant streams a reply.

It **skips automatically** when `kimi` isn't on PATH (e.g. CI), so the suite
stays green without the agent. Run just the live test:

```bash
bun run e2e --grep "live kimi acp"
```

## Run

From `apps/web`:

```bash
# first time only — installs Chromium + OS deps
bun run e2e:install

# headless (the dev server is started automatically by the config's webServer)
bun run e2e

# watch the browser
bun run e2e:headed

# interactive UI mode (best for authoring/debugging)
bun run e2e:ui
```

The Playwright config auto-starts `bun run dev` on `http://localhost:5180`
(see `playwright.config.ts` → `webServer`) and reuses an already-running server.
