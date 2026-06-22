# AGENTS.md — Hermit

This file is written for AI coding agents. It describes the actual structure, tooling, and conventions found in this repository. All details below are derived from the project files unless explicitly noted.

---

## Project overview

Hermit is a Bun-based monorepo that bridges a local ACP (Agent Client Protocol) agent to a React Native mobile app via Server-Sent Events (SSE).

- `@hermit-org/types` — shared TypeScript domain types.
- `@hermit-org/utils` — shared TypeScript helpers.
- `@hermit-org/stdio-to-sse` — Node.js server library that exposes a local stdio ACP agent as an SSE gateway.
- `@hermit-org/stdio-to-sse_rn` — React Native transport library that turns an SSE endpoint into a stdio-like readable stream.
- `@hermit-org/cli` — Bun CLI that starts the gateway and manages mobile pairing.
- `@hermit-org/mobile` — React Native app that connects to gateways, manages sessions, and renders streaming chat.

The repository uses Bun workspaces with the root `package.json` declaring `apps/*` and `packages/*` as workspaces.

---

## Technology stack

- **Package manager / runtime:** Bun (observed version `1.3.14`).
- **Workspace model:** Bun workspaces via `workspaces` in root `package.json`.
- **Language:** TypeScript, with strict mode enabled.
- **Module system:**
  - Packages (`@hermit-org/cli`, `@hermit-org/types`, `@hermit-org/utils`, `@hermit-org/stdio-to-sse`, `@hermit-org/stdio-to-sse_rn`) are ESM (`"type": "module"`).
  - The React Native app uses CommonJS for its Metro config and entry file (`metro.config.js`, `index.js`).
- **Mobile framework:** React Native `0.76.0` with React `18.3.1`.
- **Navigation:** `@react-navigation/native` + `@react-navigation/native-stack`.
- **State persistence:** Zustand + `zustand/middleware` persisted to `react-native-mmkv`.
- **CLI framework:** `commander` `^13.0.0`.
- **Mobile Markdown:** `react-native-markdown-display`.
- **Mobile SSE:** `react-native-sse`.
- **Bundler for mobile:** Metro, configured to watch `../../packages` so workspace packages can be imported by the app.
- **Test runner:** Bun test for packages; Jest referenced by `apps/mobile/package.json`.

---

## Repository layout

```
hermit/
├── package.json              # Root workspace manifest
├── tsconfig.json             # Shared TypeScript config (strict, ESNext, bundler resolution)
├── bun.lock                  # Bun lockfile
├── apps/
│   └── mobile/               # React Native app: @hermit-org/mobile
│       ├── package.json
│       ├── tsconfig.json
│       ├── metro.config.js   # Watches ../../packages for workspace imports
│       ├── app.json
│       ├── index.js
│       ├── App.tsx
│       └── src/
│           ├── types/        # Gateway, Session, Message, JSON-RPC/ACP types
│           ├── acp/          # ACP client, JSON-RPC framing, React hooks
│           ├── stores/       # Zustand + MMKV stores (gateways, sessions, settings)
│           ├── navigation/   # React Navigation root navigator
│           ├── screens/      # ServerList, SessionList, Chat
│           └── components/   # MarkdownRenderer, CodeBlock, ChatMessage, StreamingText
└── packages/
    ├── cli/                  # @hermit-org/cli — Bun CLI
    │   ├── package.json
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
    │           └── gateway.ts        # AcpGatewayServer (persistent stdio ↔ SSE)
    ├── stdio-to-sse/         # Node.js stdio ↔ SSE bridge (protocol-agnostic)
    │   ├── package.json
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
    │       └── stdio.ts              # createStdioLikeSse() helper
    ├── types/                # @hermit-org/types
    └── utils/                # @hermit-org/utils
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
bun test packages/stdio-to-sse/src
bun test packages/stdio-to-sse_rn/src/framing.test.ts
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

The CLI reads `hermit.config.json` from the current working directory. Default agent command: `npx codex --acp`.

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

---

## Code style and conventions

- **TypeScript strict mode** is enabled in the root `tsconfig.json` (`"strict": true`).
- **ESM packages** use `"type": "module"` and export from `src/index.ts`.
- **React Native app** uses JSX with `jsx: react-native` and imports shared packages as workspace dependencies (`workspace:*`).
- **CLI command discovery:** Each command file (or `index.ts` inside a command directory) exports a `command` object that is an instance of `commander.Command`.
- **Shared package exports:**
  - `@hermit-org/types` exports `User`, `Post`.
  - `@hermit-org/utils` exports `formatId`, `clamp`.
- **Environment isolation:**
  - `@hermit-org/stdio-to-sse` is Node-only (server, gateway).
  - `@hermit-org/stdio-to-sse_rn` is RN/browser-only and must not import Node built-ins.
- **File naming:** Source files use lowercase names (`post.ts`, `web.ts`, `index.ts`).
- **Comments and documentation** are minimal in source files; the project’s working language is English.

No ESLint, Prettier, or formatting configuration files were found in the repository root or package directories.

---

## Testing instructions

- Package tests use Bun's built-in test runner.
- Mobile tests use Jest (transitive dependency via React Native).
- To add tests, place them next to the code they test or in a `__tests__` directory.

---

## Security considerations

- The CLI executable (`packages/cli/src/index.ts`) has a Bun shebang and dynamically imports command modules from disk. Do not run the CLI with untrusted files present in the command directory.
- The gateway requires a valid bearer token for the SSE and `/send` endpoints. Tokens are issued via `hermit pair` and stored in `~/.hermit/authorized-tokens.json`.
- No secret files (`.env`, key stores, etc.) were found in the repository. Store tokens and pairing codes outside version control.
- Standard React Native and Node.js security practices apply: validate external input, keep native dependencies up to date, and avoid logging sensitive data.

---

## Deployment and CI

No deployment configuration, CI workflow files, Docker files, or platform-specific build scripts were observed in the repository. Deployment is currently out of scope for the checked-in code.
