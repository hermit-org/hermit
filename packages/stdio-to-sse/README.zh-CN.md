# `@hermit-org/stdio-to-sse`

[English](./README.md) | [中文](./README.zh-CN.md)

一个轻量、与协议无关的桥接库，用于将基于 stdio 的程序暴露为 HTTP POST → SSE 端点。

- **服务端（Server）**：启动一个子进程并暴露 HTTP 端点。请求体会被写入子进程的 `stdin`；子进程的 `stdout` 则以 [Server-Sent Events](https://developer.mozilla.org/zh-CN/docs/Web/API/Server-sent_events) 的形式流式返回。
- **客户端（Client）**：向该端点发送 POST 请求，并在每个 SSE 数据帧到达时实时产出。

本库不对消息格式做任何假设：JSON-RPC、MCP、ACP、纯文本等都被视为不透明字节流。

## 安装

```bash
bun add @hermit-org/stdio-to-sse
```

> 需要 Node.js 18+ 或 [Bun](https://bun.sh/)。实现仅使用 Node.js 内置模块。

## 运行测试

```bash
cd packages/stdio-to-sse
bun test
```

## 使用方式

### 服务端

```ts
import { StdioSseServer } from "@hermit-org/stdio-to-sse";

const server = new StdioSseServer({
  command: "cat",
  port: 8080,
});

const { url, stop } = await server.start();
console.log(`Bridge 监听地址：${url}`);

// 关闭服务：
await stop();
```

### 客户端

```ts
import { StdioSseClient } from "@hermit-org/stdio-to-sse";

const client = new StdioSseClient({ url: "http://localhost:8080" });

for await (const payload of client.send("hello\nworld")) {
  console.log(payload);
}
// => "hello"
// => "world"
```

### 端到端示例

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

## API 说明

### `StdioSseServer`

```ts
interface StdioSseServerOptions {
  command: string;    // 要启动的命令
  args?: string[];    // 命令参数
  port?: number;      // 默认：8080
  hostname?: string;  // 默认："0.0.0.0"
  endpoint?: string;  // 默认："/"
  cors?: boolean;     // 默认：true
  timeout?: number;   // 子进程最长运行时间（毫秒）
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

### SSE 工具函数

```ts
import { encodeSse, parseSse } from "@hermit-org/stdio-to-sse";

const frame = encodeSse("hello");
// => "data: hello\n\n"

const { data, remainder } = parseSse(frame);
// data === ["hello"]
```

## 工作原理

1. 客户端向配置的端点发送 `POST` 请求。
2. 服务端启动配置好的子进程。
3. 请求体被写入子进程的 `stdin`，随后 `stdin` 被关闭。
4. 服务端读取子进程的 `stdout`，按换行拆分，并将每一行编码为 SSE `data:` 帧。
5. 客户端解码 SSE 流并逐帧产出数据内容。

每个 HTTP 请求都会独立启动一个子进程，因此请求之间是相互隔离的。

## 持久化 Gateway 模式

如果需要长期运行的 Agent（ACP / MCP / JSON-RPC 会话），请使用 CLI 提供的
`AcpGatewayServer`。它会保持一个子进程长期存活，并分别暴露 SSE（`/`）和 stdin
（`/send`）端点：

```ts
import { AcpGatewayServer } from "@hermit-org/cli/src/lib/gateway";

const server = new AcpGatewayServer({
  command: "kimi",
  args: ["acp"],
  port: 8787,
});
const { url, stop } = await server.start();
```

## 注意事项

- 子进程应及时刷新 stdout；缓冲输出会延迟 SSE 帧的到达。
- `StdioSseServer` 会捕获 `stderr` 但直接丢弃。CLI 的 Gateway 则会将 `stderr`
  作为 SSE `error` 帧转发。
- 生产环境中请将该桥接服务置于 HTTPS 之后；本库不提供身份验证功能。
