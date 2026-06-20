# Web E2E tests (Playwright)

End-to-end tests for the `@hermit/web` app (`apps/web`), driven by
[Playwright](https://playwright.dev) with Chromium.

## What's covered

| Spec | Route | What it checks |
| --- | --- | --- |
| `routing.spec.ts` | `/`, `/?legacy`, `/?showcase`, unknown paths | The custom path router (`src/router.ts`), query-param migration, and the floating mode switcher. |
| `gateway-manager.spec.ts` | `/` | Add / edit / delete / connect gateways and connection-string import (JSON + `hermit://` deep link). |
| `showcase.spec.ts` | `/showcase` | The design preview renders mock sessions, token usage and cost — no live gateway needed. |
| `url-config.spec.ts` | `/?url=…&token=…` | The `hermit start` config handoff: `readConfigFromUrl` imports the gateway and drops the user into chat. |

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

## A note on `?url=…` and the Vite dev server

`url-config.spec.ts` runs against the **production preview build**
(`vite preview` on port 5182), not the Vite dev server. The Vite dev server
returns **HTTP 403 for any request carrying a `url=` query param** — a
deliberate Vite security feature against open-redirect / SSRF. The CLI handoff
URL (`buildConfigUrl` → `?url=…&token=…&name=…`) is consumed against a served
build, so the preview build is the correct target. In dev, use the `?payload=`
form instead.
