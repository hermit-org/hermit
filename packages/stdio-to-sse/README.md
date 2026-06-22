# `@hermit-org/stdio-to-sse`

[English](./README.md) | [中文](./README.zh-CN.md)

A tiny, protocol-agnostic bridge between a stdio program and an HTTP
POST → SSE endpoint.

- **Server**: spawns a child process and exposes an HTTP endpoint. Request
  bodies are written to the child `stdin`; child `stdout` is streamed back as
  [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).
- **Client**: sends a POST request to such an endpoint and yields each SSE
  payload as it arrives.

No assumption is made about the message format: JSON-RPC, MCP, ACP, plain text,
etc. are all treated as opaque byte streams.

## Installation

```bash
bun add @hermit-org/stdio-to-sse
```

> Requires Node.js 18+ or [Bun](https://bun.sh/). The implementation uses
> Node.js built-in modules only.

## Running tests

```bash
cd packages/stdio-to-sse
bun test
```

## Usage

### Server

```ts
import { StdioSseServer } from "@hermit-org/stdio-to-sse";

const server = new StdioSseServer({
  command: "cat",
  port: 8080,
});

const { url, stop } = await server.start();
console.log(`Bridge listening on ${url}`);

// Later:
await stop();
```

### Client

```ts
import { StdioSseClient } from "@hermit-org/stdio-to-sse";

const client = new StdioSseClient({ url: "http://localhost:8080" });

for await (const payload of client.send("hello\nworld")) {
  console.log(payload);
}
// => "hello"
// => "world"
```

### End-to-end example

```ts
import { StdioSseServer, StdioSseClient } from "@hermit-org/stdio-to-sse";

const server = new StdioSseServer({ command: "cat", port: 8080 });
const { url, stop } = await server.start();

const client = new StdioSseClient({ url });
for await (const data of client.send("ping")) {
  console.log(data);
}

await stop();
```

## API

### `StdioSseServer`

```ts
interface StdioSseServerOptions {
  command: string;    // command to spawn
  args?: string[];    // command arguments
  port?: number;      // default: 8080
  hostname?: string;  // default: "0.0.0.0"
  endpoint?: string;  // default: "/"
  cors?: boolean;     // default: true
  timeout?: number;   // max time to wait for the child process, in ms
}

class StdioSseServer {
  constructor(options: StdioSseServerOptions);
  start(): Promise<{ url: string; stop: () => Promise<void> }>;
}
```

### `StdioSseClient`

```ts
interface StdioSseClientOptions {
  url: string;
}

class StdioSseClient {
  constructor(options: StdioSseClientOptions);
  send(input: string): AsyncGenerator<string>;
}
```

### SSE utilities

```ts
import { encodeSse, parseSse } from "@hermit-org/stdio-to-sse";

const frame = encodeSse("hello");
// => "data: hello\n\n"

const { data, remainder } = parseSse(frame);
// data === ["hello"]
```

## How it works

1. Client sends a `POST` request to the configured endpoint.
2. Server spawns the configured child process.
3. Request body is written to child `stdin`, then `stdin` is closed.
4. Server reads child `stdout`, splits it by newlines, and encodes each line
   as an SSE `data:` frame.
5. Client decodes the SSE stream and yields each payload.

Each HTTP request gets its own child process, so requests are isolated.

## Persistent gateway mode

For long-lived agents (ACP / MCP / JSON-RPC sessions), use the CLI's
`AcpGatewayServer` instead. It keeps a single child process alive and exposes
separate SSE (`/`) and stdin (`/send`) endpoints:

```ts
import { AcpGatewayServer } from "@hermit-org/cli/src/lib/gateway";

const server = new AcpGatewayServer({
  command: "npx",
  args: ["codex", "--acp"],
  port: 8787,
});
const { url, stop } = await server.start();
```

## Notes

- The child process should flush its stdout promptly; buffered output will
  delay SSE frames.
- `StdioSseServer` captures `stderr` but currently discards it. The CLI gateway
  forwards `stderr` as SSE `error` frames instead.
- Keep the bridge behind HTTPS in production; this library does not provide
  authentication.
