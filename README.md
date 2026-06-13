> **English** | [中文](./README.zh-CN.md)

# Hermit

Hermit is a small Bun-based monorepo containing shared packages, a Bun CLI, and
a React Native mobile app.

## Packages & Apps

| Workspace | Path | Description |
|-----------|------|-------------|
| `@hermit/types` | `packages/types` | Shared TypeScript domain types |
| `@hermit/utils` | `packages/utils` | Shared TypeScript utility helpers |
| `@hermit/cli` | `packages/cli` | Bun CLI built with `commander`, auto-loads commands from `src/commands` |
| `@hermit/stdio-to-sse` | `packages/stdio-to-sse` | Protocol-agnostic stdio ↔ HTTP POST/SSE bridge, runs on Node.js 18+ or Bun |
| `@hermit/mobile` | `apps/mobile` | React Native mobile app with i18n support |

## Tech Stack

- **Runtime / Package Manager:** [Bun](https://bun.sh/) `1.3.14`
- **Workspace Model:** Bun workspaces (`apps/*`, `packages/*`)
- **Language:** TypeScript with strict mode
- **CLI:** `commander`
- **Mobile:** React Native `0.76.0`, React `18.3.1`, `react-i18next`
- **Testing:** `bun:test`

## Getting Started

Install dependencies from the repository root:

```bash
bun install
```

Type-check the whole monorepo:

```bash
bunx tsc --noEmit
```

## CLI

```bash
# Show help
bun packages/cli/src/index.ts --help

# Run commands
bun packages/cli/src/index.ts start
bun packages/cli/src/index.ts post
bun packages/cli/src/index.ts start web
```

Commands are auto-discovered from `packages/cli/src/commands`. See
[`packages/cli/README.md`](./packages/cli/README.md) for details.

## stdio-to-sse

`@hermit/stdio-to-sse` bridges a stdio program to an HTTP POST → SSE endpoint.
It is intentionally protocol-agnostic and works on both Node.js 18+ and Bun.

```bash
cd packages/stdio-to-sse
bun test
```

See [`packages/stdio-to-sse/README.md`](./packages/stdio-to-sse/README.md).

## Mobile

```bash
cd apps/mobile

# Start Metro
bun run start

# Run on Android / iOS
bun run android
bun run ios
```

The Metro config watches `../../packages` so shared workspace packages can be
imported directly.

## Repository Layout

```
hermit/
├── package.json              # Root workspace manifest
├── tsconfig.json             # Shared TypeScript configuration
├── bun.lock                  # Bun lockfile
├── README.md                 # This file
├── packages/
│   ├── cli/
│   ├── stdio-to-sse/
│   ├── types/
│   └── utils/
└── apps/
    └── mobile/
```

## License

MIT
