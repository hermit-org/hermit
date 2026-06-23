# Web E2E tests (Playwright)

End-to-end smoke tests for `@hermit-org/web` (`apps/web`).
Driven by [Playwright](https://playwright.dev) with Chromium.

## What's covered

The new web UI routes (see `src/router.ts` + `App.tsx`):

| Spec | Route / Flow | What it checks |
| --- | --- | --- |
| `routing.e2e.ts` | `/`, unknown paths, `/settings` | Gateway manager landing and settings page render without crashing. |
| `registration.e2e.ts` | Gateway registration → chat view | Filling the connect form redirects to `/g/:gatewayId` and loads the chat shell. |

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
