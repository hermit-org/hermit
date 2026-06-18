> **English** | [中文](./README.zh-CN.md)

# Hermit

Hermit is a Bun-based monorepo that bridges a local stdio-based agent to a React
Native mobile app via Server-Sent Events (SSE). It is designed around the ACP
(Agent Client Protocol) remote/gateway scenario, but the transport layers remain
protocol-agnostic.

## Packages & Apps

| Workspace | Path | Description |
|-----------|------|-------------|
| `@hermit/types` | `packages/types` | Shared TypeScript domain types |
| `@hermit/utils` | `packages/utils` | Shared TypeScript utility helpers |
| `@hermit/stdio-to-sse` | `packages/stdio-to-sse` | Protocol-agnostic stdio ↔ HTTP POST/SSE bridge (Node.js/Bun) |
| `@hermit/stdio-to-sse_rn` | `packages/stdio-to-sse_rn` | React Native SSE transport with stdio-like interface |
| `@hermit/acp` | `packages/acp` | Agent Client Protocol (ACP) v1 client: typed methods, session/update dispatch |
| `@hermit/cli` | `packages/cli` | Bun CLI that starts the ACP gateway and manages pairing |
| `@hermit/mobile` | `apps/mobile` | React Native app: gateway list, sessions, streaming chat |
| `@hermit/web` | `apps/web` | Vite + React web client: gateway list, sessions, streaming chat |

## Tech Stack

- **Runtime / Package Manager:** [Bun](https://bun.sh/) `1.3.14`
- **Workspace Model:** Bun workspaces (`apps/*`, `packages/*`)
- **Language:** TypeScript with strict mode
- **CLI:** `commander`
- **Mobile:** React Native `0.76.0`, React `18.3.1`, `@react-navigation/native`, Zustand, MMKV
- **Web:** Vite + React `18.3.1`, Zustand, `react-markdown`, `react-i18next`
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

Run package tests:

```bash
bun test packages/stdio-to-sse/src
bun test packages/stdio-to-sse_rn/src/framing.test.ts
bun test packages/cli/src/lib/gateway.test.ts
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLI Host (Node.js)                         │
│  ┌─────────────┐      ┌─────────────────────┐      ┌────────────┐  │
│  │ Local Agent │◄────►│ @hermit/stdio-to-sse│◄────►│  HTTP/SSE  │  │
│  │ (stdio)     │stdio │  (transport bridge) │      │  Gateway   │  │
│  └─────────────┘      └─────────────────────┘      │  :8787     │  │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │
                                                     │ Wi-Fi / LAN
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Mobile Device (React Native)                    │
│  ┌─────────────┐      ┌──────────────────────┐     ┌─────────────┐ │
│  │  UI Screens │◄────►│   @hermit/mobile     │◄───►│ @hermit/    │ │
│  │ ServerList  │      │   ACP client + UI    │     │ stdio-to-   │ │
│  │ SessionList │      │                      │     │ sse_rn      │ │
│  │    Chat     │      │                      │     │             │ │
│  └─────────────┘      └──────────────────────┘     └──────┬──────┘ │
│                                                           │        │
│                              ┌────────────────────────────┘        │
│                              ▼                                      │
│                       react-native-sse (EventSource)                │
└─────────────────────────────────────────────────────────────────────┘
```

## CLI Usage

The CLI reads `hermit.config.json` from the current working directory. A minimal
config:

```json
{
  "agent": { "command": "npx", "args": ["codex", "--acp"] },
  "gateway": {
    "port": 8787,
    "hostname": "0.0.0.0",
    "endpoint": "/",
    "heartbeatInterval": 30000,
    "cors": true
  }
}
```

### Pair a mobile device

```bash
bun packages/cli/src/index.ts pair
```

Output:

```
Hermit pairing initiated.
Pairing code : 123456
Bearer token : tok_...
```

Enter the pairing code in the mobile app. The token is stored in
`~/.hermit/authorized-tokens.json`.

### Start the gateway

```bash
bun packages/cli/src/index.ts start
```

The gateway exposes:

- `GET/POST /` — SSE stream of the agent stdout (requires bearer token)
- `POST /send` — write request body to the agent stdin (requires bearer token)
- `POST /pair` — exchange a pairing code for a bearer token
- `GET /api/config` — read-only connection info derived from `hermit.config.json`
  (no token required; used by the web client to pre-fill its connection form)

#### Connect the web client

`hermit start` accepts a `--web` option (defaults to `http://localhost:5180`).
When set, it prints a ready-to-use web URL carrying the connection config as
query params:

```bash
bun packages/cli/src/index.ts start --web http://localhost:5180
```

Opening that URL auto-configures a gateway in the web client. The web client
also supports manual entry and pasting a connection string (the JSON printed
by the CLI).

## stdio-to-sse (Node.js)

Protocol-agnostic stdio ↔ SSE bridge. Two server modes are provided:

### Request/response mode

One HTTP POST spawns one child process and returns its stdout as SSE:

```ts
import { StdioSseServer, StdioSseClient } from "@hermit/stdio-to-sse";

const server = new StdioSseServer({
  command: "cat",
  port: 8080,
});
const { url, stop } = await server.start();

const client = new StdioSseClient({ url });
for await (const line of client.send("hello\nworld")) {
  console.log(line);
}
await stop();
```

### Persistent gateway mode

Used by the CLI. A single child process stays alive; clients read via SSE and
write via `POST /send`:

```ts
import { AcpGatewayServer } from "@hermit/cli/src/lib/gateway";

const server = new AcpGatewayServer({
  command: "npx",
  args: ["codex", "--acp"],
  port: 8787,
  sendEndpoint: "/send",
});
const { url, stop } = await server.start();
```

## stdio-to-sse_rn (React Native)

RN transport that turns an SSE endpoint into a stdio-like readable stream.

```ts
import {
  RnSseConnection,
  createStdioLikeSse,
  sendMessage,
} from "@hermit/stdio-to-sse_rn";

// Low-level connection
const conn = new RnSseConnection({
  url: "http://192.168.1.5:8787",
  headers: { Authorization: "Bearer tok_..." },
});
conn.addEventListener((event) => console.log(event.type, event));
await conn.connect();

for await (const line of conn) {
  console.log("SSE line:", line);
}
```

### stdio-like abstraction

```ts
const stdio = createStdioLikeSse({
  url: "http://192.168.1.5:8787",
  sendUrl: "http://192.168.1.5:8787/send",
  headers: { Authorization: "Bearer tok_..." },
});

// read stdout lines
for await (const line of stdio.stdout) {
  console.log(line);
}

// write to stdin
await stdio.stdin.write('{"jsonrpc":"2.0","method":"ping"}\n');
```

## Mobile App

```bash
cd apps/mobile

# Install native dependencies first (CocoaPods / Gradle as usual)
bun run start

# Run on Android / iOS
bun run android
bun run ios
```

The app has three screens:

1. **Server List** — add/edit/delete gateway addresses and bearer tokens.
2. **Session List** — browse and create chat sessions for a gateway.
3. **Chat** — connect via SSE, send messages, render streaming Markdown and code
   blocks.

Add a gateway using the CLI host's IP (e.g. `http://192.168.1.5:8787`) and the
token from `hermit pair`.

## Web App

The web app is a browser replica of the mobile client. It connects to the same
ACP gateway over SSE (using `fetch` streaming, since `EventSource` cannot send
the `Authorization` header) and `POST /send`.

```bash
# 1. Start the gateway (prints a pre-configured web link)
bun packages/cli/src/index.ts start --web http://localhost:5180

# 2. Start the web client
cd apps/web
bun run dev
```

The app has three views mirroring mobile:

1. **Gateways** — add/import/edit gateway connections.
2. **Sessions** — browse and create chat sessions for a gateway.
3. **Chat** — connect via SSE, send messages, render streaming Markdown.

Connection config is resolved in priority order:

1. **URL params** — `?url=...&token=...&name=...` (the link printed by
   `hermit start`), or `?payload=<connection JSON>`.
2. **Paste a connection string** — the JSON or `hermit://connect?payload=...`
   value printed by the CLI.
3. **Manual entry** — name, SSE URL, and bearer token in the form.

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
│   ├── stdio-to-sse_rn/
│   ├── acp/
│   ├── types/
│   └── utils/
└── apps/
    ├── mobile/
    └── web/
```

## License

MIT
