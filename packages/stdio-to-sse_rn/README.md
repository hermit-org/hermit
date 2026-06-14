# `@hermit/stdio-to-sse_rn`

React Native transport layer that turns an SSE endpoint into a stdio-like
readable stream.

This package is intentionally free of Node.js built-ins. It depends on
[`react-native-sse`](https://github.com/binaryminds/react-native-sse) for the
underlying EventSource implementation.

## Installation

```bash
bun add @hermit/stdio-to-sse_rn react-native-sse
```

## Usage

### `RnSseConnection`

Low-level connection with automatic reconnection and heartbeat watchdog.

```ts
import { RnSseConnection } from "@hermit/stdio-to-sse_rn";

const conn = new RnSseConnection({
  url: "http://192.168.1.5:8787",
  headers: { Authorization: "Bearer tok_..." },
  heartbeatTimeout: 60000,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  maxReconnectAttempts: 10,
  jitter: 0.25,
});

conn.addEventListener((event) => {
  if (event.type === "state") console.log("state:", event.state);
  if (event.type === "message") console.log("data:", event.data);
  if (event.type === "error") console.error(event.error);
});

await conn.connect();

for await (const line of conn) {
  console.log(line);
}
```

### stdio-like abstraction

Useful when the consumer expects separate `stdin` and `stdout` handles, such as
a JSON-RPC client:

```ts
import { createStdioLikeSse } from "@hermit/stdio-to-sse_rn";

const stdio = createStdioLikeSse({
  url: "http://192.168.1.5:8787",
  sendUrl: "http://192.168.1.5:8787/send",
  headers: { Authorization: "Bearer tok_..." },
});

// stdout: SSE payloads as an async iterable
for await (const line of stdio.stdout) {
  console.log(line);
}

// stdin: write lines to the remote process
await stdio.stdin.write('{"jsonrpc":"2.0","method":"ping"}\n');
```

### Send a one-off POST message

```ts
import { sendMessage } from "@hermit/stdio-to-sse_rn";

await sendMessage({
  url: "http://192.168.1.5:8787/send",
  body: '{"jsonrpc":"2.0","method":"ping"}\n',
  headers: { Authorization: "Bearer tok_..." },
});
```

### JSON-RPC framing helpers

```ts
import {
  extractLines,
  parseJsonRpcMessages,
  encodeJsonRpcMessage,
} from "@hermit/stdio-to-sse_rn";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const buffer = encoder.encode('{"jsonrpc":"2.0"}\n{"jsonrpc":"2.0"}\n');
const { messages, remainder } = parseJsonRpcMessages(buffer, decoder);

const out = encodeJsonRpcMessage({ jsonrpc: "2.0", method: "pong" }, encoder);
```

## Features

- **Auto-reconnect** with exponential backoff and jitter when the connection
  drops unexpectedly.
- **Heartbeat watchdog** closes and reconnects if no traffic is received within
  the configured timeout.
- **UTF-8 safe** line framing preserves multi-byte character boundaries across
  chunk boundaries.
- **ReadableStream** wrapper via `toReadableStream()` for interoperability.

## Notes

- SSE is server-to-client only. Outbound messages are sent as separate HTTP
  POST requests to the gateway's `/send` endpoint.
- This package must not import any Node.js built-in modules; it is designed for
  React Native's Hermes / JSC runtime.
