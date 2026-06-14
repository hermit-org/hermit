> [English](./README.md) | **中文**

# Hermit

Hermit 是一个基于 Bun 的 Monorepo，通过 Server-Sent Events（SSE）将本地基于 stdio
的 Agent 桥接到 React Native 移动应用。它面向 ACP（Agent Client Protocol）远程 /
Gateway 场景设计，但传输层本身保持与协议无关。

## 包与应用

| 工作区 | 路径 | 说明 |
|-----------|------|-------------|
| `@hermit/types` | `packages/types` | 共享 TypeScript 领域类型 |
| `@hermit/utils` | `packages/utils` | 共享 TypeScript 工具函数 |
| `@hermit/stdio-to-sse` | `packages/stdio-to-sse` | 与协议无关的 stdio ↔ HTTP POST/SSE 桥接库（Node.js/Bun） |
| `@hermit/stdio-to-sse_rn` | `packages/stdio-to-sse_rn` | React Native SSE 传输层，提供 stdio-like 接口 |
| `@hermit/cli` | `packages/cli` | Bun CLI，启动 ACP Gateway 并管理配对 |
| `@hermit/mobile` | `apps/mobile` | React Native 应用：Gateway 列表、会话、流式聊天 |

## 技术栈

- **运行时 / 包管理器：** [Bun](https://bun.sh/) `1.3.14`
- **工作区模型：** Bun workspaces（`apps/*`、`packages/*`）
- **语言：** TypeScript（严格模式）
- **CLI：** `commander`
- **移动端：** React Native `0.76.0`、React `18.3.1`、`@react-navigation/native`、Zustand、MMKV
- **测试：** `bun:test`

## 快速开始

从仓库根目录安装依赖：

```bash
bun install
```

对整个 Monorepo 进行类型检查：

```bash
bunx tsc --noEmit
```

运行包测试：

```bash
bun test packages/stdio-to-sse/src
bun test packages/stdio-to-sse_rn/src/framing.test.ts
bun test packages/cli/src/lib/gateway.test.ts
```

## 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLI Host (Node.js)                         │
│  ┌─────────────┐      ┌─────────────────────┐      ┌────────────┐  │
│  │  本地 Agent │◄────►│ @hermit/stdio-to-sse│◄────►│  HTTP/SSE  │  │
│  │   (stdio)   │stdio │    （传输层桥接）    │      │  Gateway   │  │
│  └─────────────┘      └─────────────────────┘      │  :8787     │  │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │
                                                     │ Wi-Fi / LAN
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Mobile Device (React Native)                    │
│  ┌─────────────┐      ┌──────────────────────┐     ┌─────────────┐ │
│  │   UI 页面   │◄────►│    @hermit/mobile    │◄───►│ @hermit/    │ │
│  │  ServerList │      │   ACP 客户端 + UI    │     │ stdio-to-   │ │
│  │ SessionList │      │                      │     │ sse_rn      │ │
│  │    Chat     │      │                      │     │             │ │
│  └─────────────┘      └──────────────────────┘     └──────┬──────┘ │
│                                                           │        │
│                              ┌────────────────────────────┘        │
│                              ▼                                      │
│                       react-native-sse (EventSource)                │
└─────────────────────────────────────────────────────────────────────┘
```

## CLI 用法

CLI 会从当前工作目录读取 `hermit.config.json`。一个最小配置示例：

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

### 配对移动设备

```bash
bun packages/cli/src/index.ts pair
```

输出示例：

```
Hermit pairing initiated.
Pairing code : 123456
Bearer token : tok_...
```

在移动应用的 ServerList 页面输入配对码。配对成功后，token 会持久化到
`~/.hermit/authorized-tokens.json`。

### 启动 Gateway

```bash
bun packages/cli/src/index.ts start
```

Gateway 暴露以下端点：

- `GET/POST /` —— Agent stdout 的 SSE 流（需要 Bearer token）
- `POST /send` —— 将请求体写入 Agent stdin（需要 Bearer token）
- `POST /pair` —— 用配对码换取 Bearer token

## stdio-to-sse（Node.js）

与协议无关的 stdio ↔ SSE 桥接库，提供两种服务模式：

### 请求 / 响应模式

每个 HTTP POST 会启动一个子进程，并将其 stdout 以 SSE 返回：

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

### 持久化 Gateway 模式

CLI 使用此模式。一个子进程长期存活，客户端通过 SSE 读取、通过 `POST /send` 写入：

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

## stdio-to-sse_rn（React Native）

RN 传输层，将 SSE 端点转换为类似 stdio 的可读流。

```ts
import {
  RnSseConnection,
  createStdioLikeSse,
  sendMessage,
} from "@hermit/stdio-to-sse_rn";

// 底层连接
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

### stdio-like 封装

```ts
const stdio = createStdioLikeSse({
  url: "http://192.168.1.5:8787",
  sendUrl: "http://192.168.1.5:8787/send",
  headers: { Authorization: "Bearer tok_..." },
});

// 读取 stdout 行
for await (const line of stdio.stdout) {
  console.log(line);
}

// 写入 stdin
await stdio.stdin.write('{"jsonrpc":"2.0","method":"ping"}\n');
```

## 移动应用

```bash
cd apps/mobile

# 先安装原生依赖（按常规使用 CocoaPods / Gradle）
bun run start

# 运行在 Android / iOS
bun run android
bun run ios
```

应用包含三个页面：

1. **Server List** —— 添加 / 编辑 / 删除 Gateway 地址与 Bearer token。
2. **Session List** —— 浏览并创建某个 Gateway 下的聊天会话。
3. **Chat** —— 通过 SSE 连接，发送消息，流式渲染 Markdown 与代码块。

添加 Gateway 时使用 CLI 主机的 IP（例如 `http://192.168.1.5:8787`）以及
`hermit pair` 生成的 token。

## 仓库结构

```
hermit/
├── package.json              # 根工作区配置
├── tsconfig.json             # 共享 TypeScript 配置
├── bun.lock                  # Bun 锁文件
├── README.md                 # 本文件
├── packages/
│   ├── cli/
│   ├── stdio-to-sse/
│   ├── stdio-to-sse_rn/
│   ├── types/
│   └── utils/
└── apps/
    └── mobile/
```

## 许可证

MIT
