# AGENTS.md — Hermit

This file is written for AI coding agents. It describes the actual structure, tooling, and conventions found in this repository. All details below are derived from the project files unless explicitly noted.

---

## Project overview

Hermit is a small Bun-based monorepo containing:

- A shared TypeScript library of domain types (`@hermit/types`).
- A shared TypeScript utility library (`@hermit/utils`).
- A command-line interface written for the Bun runtime (`@hermit/cli`).
- A React Native mobile application (`@hermit/mobile`).

The repository uses Bun workspaces with the root `package.json` declaring `apps/*` and `packages/*` as workspaces.

---

## Technology stack

- **Package manager / runtime:** Bun (observed version `1.3.14`).
- **Workspace model:** Bun workspaces via `workspaces` in root `package.json`.
- **Language:** TypeScript, with strict mode enabled.
- **Module system:**
  - Packages (`@hermit/cli`, `@hermit/types`, `@hermit/utils`) are ESM (`"type": "module"`).
  - The React Native app uses CommonJS for its Metro config and entry file (`metro.config.js`, `index.js`).
- **Mobile framework:** React Native `0.76.0` with React `18.3.1`.
- **CLI framework:** `commander` `^13.0.0`.
- **Bundler for mobile:** Metro, configured to watch `../../packages` so workspace packages can be imported by the app.
- **Test runner:** Jest (referenced by `apps/mobile/package.json` `test` script).

---

## Repository layout

```
hermit/
├── package.json              # Root workspace manifest; only devDependencies
├── tsconfig.json             # Shared TypeScript config (strict, ESNext, bundler resolution)
├── bun.lock                  # Bun lockfile
├── apps/
│   └── mobile/               # React Native app: @hermit/mobile
│       ├── package.json
│       ├── tsconfig.json     # Extends root tsconfig
│       ├── metro.config.js   # Watches ../../packages for workspace imports
│       ├── app.json          # App name: HermitMobile
│       ├── index.js          # AppRegistry entry
│       └── App.tsx           # Root React component
└── packages/
    ├── cli/                  # @hermit/cli — Bun CLI
    │   ├── package.json
    │   └── src/
    │       ├── index.ts
    │       └── commands/
    │           ├── index.ts          # Auto-loads commands recursively
    │           ├── post.ts
    │           └── start/
    │               ├── index.ts
    │               └── web.ts
    ├── types/                # @hermit/types — shared interfaces
    │   ├── package.json
    │   └── src/index.ts      # exports User, Post
    └── utils/                # @hermit/utils — shared helpers
        ├── package.json
        └── src/index.ts      # exports formatId, clamp
```

---

## Build and development commands

### Install dependencies

```bash
bun install
```

### Type-check the whole repository

No build script is defined. Type-check across the monorepo via the shared `tsconfig.json`:

```bash
bunx tsc --noEmit
```

### Run the CLI

The CLI is executed directly by Bun. The binary name is `hermit`.

```bash
# Show help
bun packages/cli/src/index.ts --help

# Run the post command
bun packages/cli/src/index.ts post

# Run start subcommands
bun packages/cli/src/index.ts start --help
bun packages/cli/src/index.ts start web
```

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

Metro is configured to resolve workspace packages under `../../packages`, so `@hermit/types` and `@hermit/utils` can be imported directly in `App.tsx`.

---

## Code style and conventions

- **TypeScript strict mode** is enabled in the root `tsconfig.json` (`"strict": true`).
- **ESM packages** use `"type": "module"` and export from `src/index.ts`.
- **React Native app** uses JSX with `jsx: react-native` and imports shared packages as workspace dependencies (`workspace:*`).
- **CLI command discovery:** Each command file (or `index.ts` inside a command directory) exports a `command` object that is an instance of `commander.Command`. The loader in `packages/cli/src/commands/index.ts` scans the `commands` directory recursively and attaches discovered commands.
- **Shared package exports:**
  - `@hermit/types` currently exports `User` and `Post` interfaces.
  - `@hermit/utils` currently exports `formatId` and `clamp` helpers.
- **File naming:** Source files use lowercase names (`post.ts`, `web.ts`, `index.ts`).
- **Comments and documentation** are minimal in source files; the project’s working language is English.

No ESLint, Prettier, or formatting configuration files were found in the repository root or package directories.

---

## Testing instructions

- The only test-related script is in `apps/mobile/package.json`:
  ```bash
  cd apps/mobile && bun run test   # runs jest
  ```
- No project-level test files (`.test.*` or `.spec.*`) exist in `apps/` or `packages/` at this time.
- To add tests, place them next to the code they test or in a `__tests__` directory. Jest is already a transitive dependency through React Native tooling.

---

## Security considerations

- The CLI executable (`packages/cli/src/index.ts`) has a Bun shebang (`#!/usr/bin/env bun`) and dynamically imports command modules from disk. Do not run the CLI with untrusted files present in the command directory.
- No secret files (`.env`, key stores, etc.) were found in the repository. If secrets are needed later, store them outside version control.
- Standard React Native and Node.js security practices apply: validate external input, keep native dependencies up to date, and avoid logging sensitive data.

---

## Deployment and CI

No deployment configuration, CI workflow files, Docker files, or platform-specific build scripts were observed in the repository. Deployment is currently out of scope for the checked-in code.
