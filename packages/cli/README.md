# `@hermit/cli`

Bun CLI for Hermit. Manages local ACP agents, exposes them as an SSE gateway,
and handles mobile device pairing.

## Commands

```bash
# Show help
bun packages/cli/src/index.ts --help

# Generate a pairing code
bun packages/cli/src/index.ts pair

# Start the gateway
bun packages/cli/src/index.ts start
```

## Configuration

The CLI reads `hermit.config.json` from the current working directory.

```json
{
  "agent": {
    "command": "npx",
    "args": ["codex", "--acp"]
  },
  "gateway": {
    "port": 8787,
    "hostname": "0.0.0.0",
    "endpoint": "/",
    "sendEndpoint": "/send",
    "heartbeatInterval": 30000,
    "cors": true,
    "timeout": 0
  },
  "authorizedTokens": []
}
```

## Gateway endpoints

When running `start`, the CLI exposes:

- `GET/POST /` — SSE stream of the agent stdout (requires bearer token)
- `POST /send` — write request body to agent stdin (requires bearer token)
- `POST /pair` — exchange a 6-digit pairing code for a bearer token

## Pairing flow

1. Run `bun packages/cli/src/index.ts pair`.
2. Enter the displayed 6-digit code in the Hermit mobile app.
3. The app calls `POST /pair` and receives a bearer token.
4. The token is persisted in `~/.hermit/authorized-tokens.json`.

## Programmatic usage

```ts
import { AcpGatewayServer } from "@hermit/cli/src/lib/gateway";

const server = new AcpGatewayServer({
  command: "npx",
  args: ["codex", "--acp"],
  port: 8787,
  onRequest: async (req, res) => {
    // Custom auth / routing logic
    return false;
  },
});

const { url, stop } = await server.start();
```
