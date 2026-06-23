# `@hermit-org/cli`

Bun CLI for Hermit. Manages local ACP agents, exposes them as an SSE gateway,
and handles mobile device pairing.

## Commands

```bash
# bun (from source)
bun packages/cli/src/index.ts --help

# bunx (npm bin)
bunx hermit --help

# npx (npm bin)
npx @hermit-org/cli --help

# Generate a pairing code
bunx hermit pair

# Start the gateway
bunx hermit start
```

## Configuration

The CLI reads `hermit.config.json` from the current working directory.

```json
{
  "agent": {
    "command": "kimi",
    "args": ["acp"]
  },
  "gateway": {
    "port": 8787,
    "hostname": "0.0.0.0",
    "endpoint": "/",
    "heartbeatInterval": 30000,
    "cors": true,
    "timeout": 0
  },
  "authorizedTokens": []
}
```

## Gateway endpoints

When running `start`, the CLI exposes:

- `GET /` — SSE stream of the agent stdout (requires bearer token)
- `POST /send` — write request body to agent stdin (requires bearer token)
- `POST /pair` — exchange a 6-digit pairing code for a bearer token
- `GET /api/config` — read-only connection info (no token required)

Pass `--web <url>` to print a pre-configured URL for the web client.

## Pairing flow

1. Run `bunx hermit pair`.
2. Enter the displayed 6-digit code in the Hermit mobile app.
3. The app calls `POST /pair` and receives a bearer token.
4. The token is persisted in `~/.hermit/authorized-tokens.json`.

## Programmatic usage

```ts
import { AcpGatewayServer } from "@hermit-org/cli/src/lib/gateway";

const server = new AcpGatewayServer({
  command: "kimi",
  args: ["acp"],
  port: 8787,
});

const { url, stop } = await server.start();
```
