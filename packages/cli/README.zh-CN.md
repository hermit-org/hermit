# `@hermit-org/cli`

Hermit 的 Bun CLI。管理本地 ACP Agent，将其暴露为 SSE Gateway，并处理移动设备配对。

## 命令

```bash
# 显示帮助
bun packages/cli/src/index.ts --help

# 生成配对码
bun packages/cli/src/index.ts pair

# 启动 Gateway
bun packages/cli/src/index.ts start
```

## 配置

CLI 会从当前工作目录读取 `hermit.config.json`。

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

## Gateway 端点

执行 `start` 后，CLI 暴露以下端点：

- `GET/POST /` —— Agent stdout 的 SSE 流（需要 Bearer token）
- `POST /send` —— 将请求体写入 Agent stdin（需要 Bearer token）
- `POST /pair` —— 用 6 位配对码换取 Bearer token

## 配对流程

1. 运行 `bun packages/cli/src/index.ts pair`。
2. 在 Hermit 移动应用的 ServerList 页面输入显示的 6 位配对码。
3. 应用调用 `POST /pair` 获取 Bearer token。
4. Token 持久化到 `~/.hermit/authorized-tokens.json`。

## 编程方式使用

```ts
import { AcpGatewayServer } from "@hermit-org/cli/src/lib/gateway";

const server = new AcpGatewayServer({
  command: "npx",
  args: ["codex", "--acp"],
  port: 8787,
  onRequest: async (req, res) => {
    // 自定义认证 / 路由逻辑
    return false;
  },
});

const { url, stop } = await server.start();
```
