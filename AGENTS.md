# AGENTS.md — Hermit

This file is written for AI coding agents. It describes the actual structure, tooling, and conventions found in this repository. All details below are derived from the project files unless explicitly noted.

---

## Project overview

Hermit is a Bun-based monorepo that bridges a local ACP (Agent Client Protocol) agent to React Native mobile and React web clients via Server-Sent Events (SSE).

- `@hermit-org/types` — shared TypeScript domain types.
- `@hermit-org/utils` — shared TypeScript helpers.
- `@hermit-org/acp` — ACP v1 client library (typed methods, session/update dispatch, JSON-RPC framing).
- `@hermit-org/stdio-to-sse` — Node.js server library that exposes a local stdio ACP agent as an SSE gateway.
- `@hermit-org/stdio-to-sse_rn` — React Native transport library that turns an SSE endpoint into a stdio-like readable stream.
- `@hermit-org/cli` — Bun CLI that starts the gateway and manages mobile pairing.
- `@hermit-org/mobile` — React Native app that connects to gateways, manages sessions, and renders streaming chat.
- `@hermit-org/web` — Vite + React web client with gateway management, session-based chat, and streaming Markdown rendering.

The repository uses Bun workspaces with the root `package.json` declaring `apps/*` and `packages/*` as workspaces.

---

## Technology stack

- **Package manager / runtime:** Bun (observed version `1.3.14`).
- **Workspace model:** Bun workspaces via `workspaces` in root `package.json`.
- **Language:** TypeScript, with strict mode enabled.
- **Module system:**
  - Packages (`@hermit-org/acp`, `@hermit-org/cli`, `@hermit-org/types`, `@hermit-org/utils`, `@hermit-org/stdio-to-sse`, `@hermit-org/stdio-to-sse_rn`) are ESM (`"type": "module"`).
  - The web app is ESM (`"type": "module"`).
  - The React Native app uses CommonJS for its Metro config and entry file (`metro.config.js`, `index.js`).
- **Mobile framework:** React Native `0.76.0` with React `18.3.1`.
- **Web framework:** Vite `5.4` + React `18.3.1` + Tailwind CSS `3.4` + Radix UI.
- **Navigation (mobile):** `@react-navigation/native` + `@react-navigation/native-stack`.
- **State persistence (mobile):** Zustand + `zustand/middleware` persisted to `react-native-mmkv`.
- **State management (web):** Zustand.
- **CLI framework:** `commander` `^13.0.0`.
- **CLI QR codes:** `qrcode` `^1.5.4`.
- **Mobile Markdown:** `react-native-markdown-display`.
- **Web Markdown:** `react-markdown` + `remark-gfm`.
- **Mobile SSE:** `react-native-sse`.
- **Mobile QR scanner:** `react-native-camera-kit`.
- **Internationalization (mobile + web):** `i18next` + `react-i18next`.
- **Bundler for mobile:** Metro, configured to watch `../../packages` so workspace packages can be imported by the app.
- **Test runner:** Bun test for packages; Jest referenced by `apps/mobile/package.json`; Playwright for web E2E tests.
- **Web icons:** `lucide-react`.

---

## Repository layout

```
hermit/
├── package.json              # Root workspace manifest
├── tsconfig.json             # Shared TypeScript config (strict, ESNext, bundler resolution)
├── bun.lock                  # Bun lockfile
├── hermit.config.json        # Default agent command: "kimi acp", gateway config
├── scripts/
│   ├── kimi-mock-agent.js    # Mock ACP agent for local testing
│   └── test-acp-kimi.ts      # E2E test script for ACP + Kimi agent
├── .github/
│   └── workflows/
│       ├── build-android.yml       # Android APK build
│       ├── deploy-web.yml          # Web deploy to GitHub Pages
│       └── publish-packages.yml    # Publish packages to npm
├── apps/
│   ├── mobile/               # React Native app: @hermit-org/mobile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── metro.config.js   # Watches ../../packages for workspace imports
│   │   ├── app.json
│   │   ├── index.js
│   │   ├── App.tsx
│   │   └── src/
│   │       ├── types/        # Gateway, Session, Message, JSON-RPC/ACP types
│   │       ├── acp/          # ACP client, JSON-RPC framing, React hooks
│   │       ├── stores/       # Zustand + MMKV stores (gateways, sessions, settings)
│   │       ├── navigation/   # React Navigation root navigator
│   │       ├── screens/      # ServerListScreen, SessionListScreen, ChatScreen, QrScannerScreen
│   │       ├── components/   # MarkdownRenderer, CodeBlock, ChatMessage, StreamingText, GlobalLoading, Loading
│   │       ├── hooks/        # useLoading
│   │       └── i18n/         # i18next locales + config
│   └── web/                  # Vite React web app: @hermit-org/web
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts    # Uses @/ alias for src/, port 5180
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── playwright.config.ts
│       ├── index.html
│       ├── e2e/              # Playwright E2E specs (*.e2e.ts)
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── router.ts
│           ├── config.ts
│           ├── styles.css
│           ├── pages/        # RealApp, gateway-manager, acp-client-page, settings-page, error-boundary
│           ├── stores/       # Zustand stores (gateway, session, settings, permission)
│           ├── components/   # ChatMessage, MarkdownRenderer, ThoughtView, ToolCallView, ConfigChip, streaming-text, domain
│           │   ├── ui/       # Radix UI primitives (button, dialog, select, tabs, etc.)
│           │   ├── atoms/    # Small reusable components (spinner, badge, timestamp, etc.)
│           │   ├── molecules/ # Composite components (message-bubble, tool-call-card, etc.)
│           │   ├── organisms/ # Section-level components (chat-area, session-sidebar, etc.)
│           │   └── templates/ # Layout templates (settings-layout)
│           ├── hooks/        # useAcpPageAdapter
│           ├── acp/          # ACP hooks + index
│           ├── transport/    # SSE transport (connection, stdio)
│           ├── i18n/         # i18next locales + config
│           ├── types/
│           └── lib/          # utils
└── packages/
    ├── acp/                  # @hermit-org/acp — ACP v1 client library
    │   ├── package.json
    │   └── src/
    │       ├── index.ts
    │       ├── client.ts     # createAcpClient, AcpClient, AcpClientHandlers, AcpClientOptions
    │       ├── types.ts      # ACP protocol types, enums (AcpMethod, AcpNotification, AcpServerMethod)
    │       ├── jsonrpc.ts    # JSON-RPC 2.0 create/parse/encode helpers
    │       ├── transport.ts  # StdioTransport interface
    │       └── client.test.ts
    ├── cli/                  # @hermit-org/cli — Bun CLI
    │   ├── package.json      # bin: "hermit": "./src/index.ts"
    │   └── src/
    │       ├── index.ts
    │       ├── commands/
    │       │   ├── index.ts          # Auto-loads commands recursively
    │       │   ├── pair.ts           # Generate pairing code
    │       │   └── start/
    │       │       └── index.ts      # Start ACP gateway
    │       └── lib/
    │           ├── config.ts         # hermit.config.json loading
    │           ├── pairing.ts        # Pairing code / bearer token logic
    │           ├── gateway.ts        # AcpGatewayServer (persistent stdio ↔ SSE)
    │           ├── gateway.test.ts
    │           └── qr.ts             # QR code generation for pairing
    ├── stdio-to-sse/         # Node.js stdio ↔ SSE bridge (protocol-agnostic)
    │   ├── package.json      # Subpath exports: ./client, ./server; react-native/browser → index.native.ts
    │   └── src/
    │       ├── index.ts
    │       ├── index.native.ts       # RN-safe re-export (client + sse utilities)
    │       ├── sse.ts                # SSE encode/decode + JSON-RPC line framing
    │       ├── server.ts             # StdioSseServer (request/response mode)
    │       ├── client.ts             # StdioSseClient (SSE consumer with retries)
    │       └── *.test.ts
    ├── stdio-to-sse_rn/      # React Native SSE transport
    │   ├── package.json
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts              # Connection state + events
    │       ├── connection.ts         # RnSseConnection (auto-reconnect, heartbeat)
    │       ├── framing.ts            # UTF-8 safe JSON-RPC line framing
    │       ├── http.ts               # POST helper for gateway /send
    │       ├── stdio.ts              # createStdioLikeSse() helper
    │       └── framing.test.ts
    ├── types/                # @hermit-org/types (v0.0.1)
    ├── types/                # @hermit-org/types (v0.0.1)
    └── utils/                # @hermit-org/utils (v0.0.1)
        ├── src/
        │   ├── index.ts
        │   └── index.test.ts
        └── package.json
```

---

## Build and development commands

### Install dependencies

```bash
bun install
```

### Type-check the whole repository

```bash
bunx tsc --noEmit
```

### Run package tests

```bash
# Run all Bun tests (packages + apps/web/src, excludes Playwright E2E)
bun run test

# Run individual package test suites
bun test packages/stdio-to-sse/src
bun test packages/stdio-to-sse_rn/src/framing.test.ts
bun test packages/acp/src/client.test.ts
bun test packages/cli/src/lib/gateway.test.ts
bun test packages/cli/src/lib/qr.test.ts
bun test packages/utils/src/index.test.ts
```

### Run the CLI

```bash
# Show help
bun packages/cli/src/index.ts --help

# Generate a pairing code
bun packages/cli/src/index.ts pair

# Start the ACP gateway
bun packages/cli/src/index.ts start
```

The CLI reads `hermit.config.json` from the current working directory. Default agent command: `kimi acp`. Gateway config includes `port`, `hostname`, `endpoint`, `heartbeatInterval`, `cors`, `timeout`, and `authorizedTokens`.

The CLI can also be installed globally via `bun install -g @hermit-org/cli` and invoked as `hermit`.

### Run the mobile app

From `apps/mobile`:

```bash
cd apps/mobile

# Start the Metro bundler
bun run start

# Run on Android
bun run android

# Run on iOS
bun run ios
```

Metro watches `../../packages`, so all workspace packages resolve directly.

### Run the web app

From `apps/web`:

```bash
cd apps/web

# Start the Vite dev server (port 5180)
bun run dev

# Build for production
bun run build

# Run Playwright E2E tests (*.e2e.ts)
bun run e2e

# Install Playwright browsers
bun run e2e:install
```

### Mock agent for testing

```bash
# Start a mock ACP agent for local development
bun scripts/kimi-mock-agent.js

# E2E test with the Kimi agent
bun run scripts/test-acp-kimi.ts
```

---

## Code style and conventions

- **TypeScript strict mode** is enabled in the root `tsconfig.json` (`"strict": true`).
- **ESM packages** use `"type": "module"` and export from `src/index.ts`.
- **React Native app** uses JSX with `jsx: react-native` and imports shared packages as workspace dependencies (`workspace:*`).
- **Web app** uses JSX with `react-jsx` and a `@/` path alias pointing to `src/` (configured in `vite.config.ts`).
- **CLI command discovery:** Each command file (or `index.ts` inside a command directory) exports a `command` object that is an instance of `commander.Command`.
- **Shared package exports:**
  - `@hermit-org/types` exports domain types.
  - `@hermit-org/utils` exports `formatId`, `clamp`.
  - `@hermit-org/acp` exports `createAcpClient`, `AcpClient`, `AcpClientOptions`, `AcpClientHandlers`, `StdioTransport`, JSON-RPC utilities, and ACP protocol types/enums.
  - `@hermit-org/stdio-to-sse` exports subpaths: `.` (server), `./client`, `./server`.
- **Environment isolation:**
  - `@hermit-org/acp` is platform-agnostic (only a `StdioTransport` interface).
  - `@hermit-org/stdio-to-sse` conditionally exports `index.native.ts` for `react-native` and `browser` environments.
  - `@hermit-org/stdio-to-sse_rn` is RN/browser-only and must not import Node built-ins.
- **Web component architecture:** Follows atomic design — `ui/` (Radix primitives), `atoms/`, `molecules/`, `organisms/`, `templates/`.
- **File naming:** Source files use lowercase names (`client.ts`, `gateway.ts`, `index.ts`). React components use PascalCase or kebab-case.
- **Comments and documentation** are minimal in source files; the project's working language is English.

No ESLint, Prettier, or formatting configuration files were found in the repository root or package directories.

---

## Testing instructions

- **Package tests** use Bun's built-in test runner. Place test files next to the code they test (e.g., `*.test.ts`).
- **Mobile tests** use Jest (transitive dependency via React Native).
- **Web E2E tests** use Playwright. Test specs live in `apps/web/e2e/`.
- To add tests, place them next to the code they test or in a `__tests__` directory.

---

## Security considerations

- The CLI executable (`packages/cli/src/index.ts`) has a Bun shebang and dynamically imports command modules from disk. Do not run the CLI with untrusted files present in the command directory.
- The gateway requires a valid bearer token for the SSE and `/send` endpoints. Tokens are issued via `hermit pair` and stored in `~/.hermit/authorized-tokens.json`. The `hermit.config.json` `authorizedTokens` field holds the current authorized token list.
- No secret files (`.env`, key stores, etc.) were found in the repository. Store tokens and pairing codes outside version control.
- Standard React Native, React, and Node.js security practices apply: validate external input, keep native dependencies up to date, and avoid logging sensitive data.

---

## Deployment and CI

GitHub Actions workflows are defined in `.github/workflows/`:

- `build-android.yml` — Builds the Android APK.
- `deploy-web.yml` — Deploys the web app to GitHub Pages.
- `publish-packages.yml` — Publishes workspace packages to npm.

No Docker files, Kubernetes manifests, or other platform-specific deployment scripts were observed in the repository.

---

## Configuration reference

`hermit.config.json` schema (at project root):

- `agent.command` — The ACP agent command (default: `"npx"`).
- `agent.args` — Arguments passed to the agent command (default: `["codex", "--acp"]`).
- `agent.cwd` — Working directory for the spawned agent process (default: the directory where `hermit start` is launched).
- `gateway.port` — Gateway listen port (default: `8787`).
- `gateway.hostname` — Gateway bind address (default: `"0.0.0.0"`).
- `gateway.endpoint` — SSE endpoint path (default: `"/"`).
- `gateway.heartbeatInterval` — Heartbeat interval in ms (default: `30000`).
- `gateway.idleTimeout` — Idle timeout in ms. If no active ACP prompts, no `/send` input, and no stdout/stderr activity occur for this long, the agent process is stopped; the gateway keeps running and respawns the agent on the next SSE or `/send` request. `0` disables it (default: `300000`).
- `gateway.cors` — Enable CORS headers (default: `true`).
- `gateway.timeout` — Gateway timeout in ms; `0` means no timeout (default: `0`).
- `authorizedTokens` — List of bearer tokens authorized to connect (default: `[]`).
