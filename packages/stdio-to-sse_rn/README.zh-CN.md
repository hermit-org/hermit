# `@hermit/stdio-to-sse_rn`

React Native 传输层，将 SSE 端点转换为类似 stdio 的可读流。

本包刻意避免使用任何 Node.js 内置模块，依赖
[`react-native-sse`](https://github.com/binaryminds/react-native-sse) 提供底层
EventSource 实现。

## 安装

```bash
bun add @hermit/stdio-to-sse_rn react-native-sse
```

## 使用方式

### `RnSseConnection`

底层连接，支持自动重连与心跳看门狗。

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

### stdio-like 封装

适合需要独立 `stdin` / `stdout` 句柄的场景，例如 JSON-RPC 客户端：

```ts
import { createStdioLikeSse } from "@hermit/stdio-to-sse_rn";

const stdio = createStdioLikeSse({
  url: "http://192.168.1.5:8787",
  sendUrl: "http://192.168.1.5:8787/send",
  headers: { Authorization: "Bearer tok_..." },
});

// stdout：SSE 数据流作为异步可迭代对象
for await (const line of stdio.stdout) {
  console.log(line);
}

// stdin：向远程进程写入行
await stdio.stdin.write('{"jsonrpc":"2.0","method":"ping"}\n');
```

### 发送一次性 POST 消息

```ts
import { sendMessage } from "@hermit/stdio-to-sse_rn";

await sendMessage({
  url: "http://192.168.1.5:8787/send",
  body: '{"jsonrpc":"2.0","method":"ping"}\n',
  headers: { Authorization: "Bearer tok_..." },
});
```

### JSON-RPC framing 辅助函数

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

## 特性

- **自动重连**：连接异常断开时按指数退避 + 抖动策略重连。
- **心跳看门狗**：在配置的超时时间内无流量时自动关闭并重连。
- **UTF-8 安全**：行分隔解析保留跨 chunk 的多字节字符边界。
- **ReadableStream**：通过 `toReadableStream()` 提供标准 Web Stream 接口。

## 注意事项

- SSE 仅为服务端到客户端。 outbound 消息需通过 Gateway 的 `/send` 端点以单独
  HTTP POST 发送。
- 本包不能引入任何 Node.js 内置模块，面向 React Native Hermes / JSC 运行时设计。
