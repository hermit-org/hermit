> [English](./README.md) | **中文**

# Hermit

Hermit 是一个基于 Bun 的 Monorepo，通过 Server-Sent Events（SSE）将本地基于 stdio
的 Agent 桥接到 React Native 移动应用。它面向 ACP（Agent Client Protocol）远程 /
Gateway 场景设计，但传输层本身保持与协议无关。

## 支持的 Agent

Hermit 可与任何实现了 [Agent Client
Protocol](https://agentclientprotocol.com/) 的本地 stdio Agent 配合使用。已测试并支持的 Agent 包括：

- [Kimi Code](https://www.kimi.com/code)
- [GitHub Copilot CLI](https://github.com/features/copilot/cli/)
- [Kilo](https://kilo.ai/)

更多 ACP 兼容 Agent 请参见
[agentclientprotocol.com/get-started/agents](https://agentclientprotocol.com/get-started/agents)。

## 包与应用

| 工作区 | 路径 | 说明 |
|-----------|------|-------------|
| `@hermit-org/types` | `packages/types` | 共享 TypeScript 领域类型 |
| `@hermit-org/utils` | `packages/utils` | 共享 TypeScript 工具函数 |
| `@hermit-org/stdio-to-sse` | `packages/stdio-to-sse` | 与协议无关的 stdio ↔ HTTP POST/SSE 桥接库（Node.js/Bun） |
| `@hermit-org/stdio-to-sse_rn` | `packages/stdio-to-sse_rn` | React Native SSE 传输层，提供 stdio-like 接口 |
| `@hermit-org/acp` | `packages/acp` | Agent Client Protocol (ACP) v1 客户端：类型化方法、session/update 分发 |
| `@hermit-org/cli` | `packages/cli` | Bun CLI，启动 ACP Gateway 并管理配对 |
| `@hermit-org/mobile` | `apps/mobile` | React Native 应用：Gateway 列表、会话、流式聊天 |
| `@hermit-org/web` | `apps/web` | Vite + React Web 客户端：Gateway 列表、会话、流式聊天 |

## 技术栈

- **运行时 / 包管理器：** [Bun](https://bun.sh/) `1.3.14`
- **工作区模型：** Bun workspaces（`apps/*`、`packages/*`）
- **语言：** TypeScript（严格模式）
- **CLI：** `commander`
- **移动端：** React Native `0.76.0`、React `18.3.1`、`@react-navigation/native`、Zustand、MMKV
- **Web：** Vite + React `18.3.1`、Zustand、`react-markdown`、`react-i18next`
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
│                          CLI Host (Bun/Node.js)                     │
│  ┌─────────────┐      ┌─────────────────────┐      ┌────────────┐  │
│  │  本地 Agent │◄────►│ @hermit-org/stdio-to-sse│◄────►│  HTTP/SSE  │  │
│  │   (stdio)   │stdio │    （传输层桥接）    │      │  Gateway   │  │
│  └─────────────┘      └─────────────────────┘      │  :8787     │  │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │
                                                     │ Wi-Fi / LAN
                  ┌──────────────────────────────────┤
                  ▼                                  ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│      移动端 (React Native)      │  │     Web 端 (Vite + React)       │
│  ┌───────────┐  ┌────────────┐  │  │  ┌───────────┐  ┌────────────┐  │
│  │  UI 页面  │◄►│ @hermit-org/│  │  │  │   页面    │◄►│ SSE fetch   │  │
│  │ ServerList│  │ stdio-to-  │  │  │  │ Gateways  │  │ transport   │  │
│  │SessionList│  │ sse_rn     │  │  │  │ Sessions  │  │             │  │
│  │   Chat    │  │            │  │  │  │   Chat    │  │             │  │
│  └───────────┘  └─────┬──────┘  │  │  └───────────┘  └──────┬──────┘  │
│                       │         │  │                         │         │
│              react-native-sse   │  │              fetch (streaming)  │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

## CLI 用法

CLI 会从当前工作目录读取 `hermit.config.json`。一个最小配置示例：

```json
{
  "agent": { "command": "kimi", "args": ["acp"] },
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

- `GET /` —— Agent stdout 的 SSE 流（需要 Bearer token）
- `POST /send` —— 将请求体写入 Agent stdin（需要 Bearer token）
- `POST /pair` —— 用配对码换取 Bearer token
- `GET /api/config` —— 只读连接信息（由 `hermit.config.json` 推导，无需
  token；供 Web 客户端预填连接表单使用）

#### 连接 Web 客户端

`hermit start` 接受 `--web` 选项（默认 `http://localhost:5180`）。设置后，
会打印一个将连接配置作为查询参数携带的、可直接使用的 Web URL：

```bash
bun packages/cli/src/index.ts start --web http://localhost:5180
```

打开该 URL 即可在 Web 客户端自动配置一个 Gateway。Web 客户端也支持手动
填写和粘贴连接字符串（CLI 打印的 JSON）。

## stdio-to-sse（Node.js）

与协议无关的 stdio ↔ SSE 桥接库，提供两种服务模式：

### 请求 / 响应模式

每个 HTTP POST 会启动一个子进程，并将其 stdout 以 SSE 返回：

```ts
import { StdioSseServer, StdioSseClient } from "@hermit-org/stdio-to-sse";

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
import { AcpGatewayServer } from "@hermit-org/cli/src/lib/gateway";

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
} from "@hermit-org/stdio-to-sse_rn";

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

应用包含四个页面：

1. **Server List** —— 添加 / 编辑 / 删除 Gateway 地址与 Bearer token。
2. **Session List** —— 浏览并创建某个 Gateway 下的聊天会话。
3. **Chat** —— 通过 SSE 连接，发送消息，流式渲染 Markdown 与代码块。
4. **QR Scanner** —— 扫描配对二维码自动配置 Gateway。

添加 Gateway 时使用 CLI 主机的 IP（例如 `http://192.168.1.5:8787`）以及
`hermit pair` 生成的 token，或扫描终端中显示的配对二维码。

## Web 应用

Web 应用是移动客户端的浏览器复刻版。它通过 SSE 连接同一个 ACP
Gateway（因为浏览器 `EventSource` 无法发送 `Authorization` 头，改用
`fetch` 流式读取）以及 `POST /send`。

```bash
# 1. 启动 Gateway（会打印预配置好的 Web 链接）
bun packages/cli/src/index.ts start --web http://localhost:5180

# 2. 启动 Web 客户端
cd apps/web
bun run dev
```

应用包含三个与移动端对应的页面：

1. **Gateways** —— 添加 / 导入 / 编辑 Gateway 连接。
2. **Sessions** —— 浏览并创建某个 Gateway 下的聊天会话。
3. **Chat** —— 通过 SSE 连接，发送消息，流式渲染 Markdown。

连接配置按优先级依次解析：

1. **URL 参数** —— `?url=...&token=...&name=...`（`hermit start` 打印的
   链接）或 `?payload=<连接 JSON>`。
2. **粘贴连接字符串** —— CLI 打印的 JSON 或 `hermit://connect?payload=...`。
3. **手动填写** —— 在表单中填写名称、SSE 地址和 Bearer token。

## 仓库结构

```
hermit/
├── package.json              # 根工作区配置
├── tsconfig.json             # 共享 TypeScript 配置
├── bun.lock                  # Bun 锁文件
├── hermit.config.json        # 默认网关与 Agent 配置
├── README.md                 # 本文件
├── scripts/
│   ├── kimi-mock-agent.js    # 本地测试用 Mock ACP Agent
│   └── test-acp-kimi.ts      # ACP + Kimi 端到端测试脚本
├── .github/workflows/        # CI/CD 流水线
├── packages/
│   ├── acp/                  # @hermit-org/acp — ACP v1 客户端库
│   ├── cli/                  # @hermit-org/cli — Bun CLI
│   ├── stdio-to-sse/         # Node.js stdio ↔ SSE 桥接库
│   ├── stdio-to-sse_rn/      # React Native SSE 传输层
│   ├── types/                # @hermit-org/types
│   └── utils/                # @hermit-org/utils
└── apps/
    ├── mobile/               # React Native 移动应用
    └── web/                  # Vite + React Web 应用
```

## 许可证

MIT
