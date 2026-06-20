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

Labels come from i18n (`src/i18n/locales/en.json`); the default language is
English (`navigator.language` → en).

## Not covered (needs a live gateway)

The agent-side session list and full chat streaming (send → assistant reply →
tool calls) require a running gateway + agent (`hermit start` + e.g.
`npx codex --acp`). The local-session and chat-shell behaviour above works
without a backend.

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
