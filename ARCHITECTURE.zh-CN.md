> [English](./ARCHITECTURE.md) | **中文**

# Hermit 发布与部署指南

## 1. 发布前验证（本地）

任何发布或部署前必须执行以下检查。

```bash
# 1.1 安装并链接 workspace
bun install

# 1.2 全仓类型检查
bunx tsc --noEmit

# 1.3 更新受影响 package.json 的版本号
#     确认无 workspace:* 依赖残留（发布包需替换为实际 semver 版本）

# 1.4 npm 发布干跑
bun publish --dry-run

# 1.5 端到端测试网关（使用 Mock Agent）
bun scripts/kimi-mock-agent.js &
AGENT_PID=$!
bun packages/cli/src/index.ts start --command node --args "scripts/kimi-mock-agent.js"

# 在另一个终端执行：
curl -N -H "Authorization: Bearer <token>" http://localhost:8787/   # 应成功连接 SSE
curl -X POST http://localhost:8787/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/plain" \
  -d '{"jsonrpc":"2.0","id":1,"method":"$/agent/info"}'              # SSE 应收到响应

# 测试完成后停止 Mock Agent：
kill $AGENT_PID
```

所有检查通过后再继续。

---

## 2. 版本管理（独立版本）

Hermit 采用各包独立版本。当前所有包版本均为 `0.0.1`。

### 2.1 版本更新顺序

如果 `@hermit-org/cli` 依赖了新版本 `@hermit-org/stdio-to-sse`，按以下顺序更新和发布：

```
types → utils → stdio-to-sse → cli → web → mobile
```

（`@hermit-org/acp` 和 `@hermit-org/stdio-to-sse_rn` 目前为 `private: true`，不发布到 npm。）

### 2.2 提升版本号

```bash
cd packages/stdio-to-sse
# 方式 A：npm version
npm version patch   # 或 minor / major

# 方式 B：手动修改 package.json 的 version 字段
```

版本变更后重新生成 `bun.lock`：

```bash
bun install
```

---

## 3. npm 发布

发布到 npm 的包按顺序为：`types`、`utils`、`stdio-to-sse`、`cli`。

### 3.1 发布前准备

```bash
# 确认无 workspace:* 残留（发布前必须替换为实际版本号）
grep -r "workspace:\*" packages/types/package.json packages/utils/package.json packages/stdio-to-sse/package.json packages/cli/package.json

# 登录 npm
npm login

# 确认 npm organization 已存在
npm org ls @hermit-org
```

### 3.2 发布步骤

```bash
cd packages/types && npm publish --access public && cd ../..
cd packages/utils && npm publish --access public && cd ../..
cd packages/stdio-to-sse && npm publish --access public && cd ../..
cd packages/cli && npm publish --access public && cd ../..

# 确认版本已上线
npm view @hermit-org/types versions
npm view @hermit-org/utils versions
npm view @hermit-org/stdio-to-sse versions
npm view @hermit-org/cli versions
```

### 3.3 打 tag

```bash
git tag v0.1.2
git push origin v0.1.2
```

推送 `v*` 格式的 tag 会触发 `publish-packages.yml` workflow 自动发布。

---

## 4. GitHub Actions (CI/CD)

项目包含三个 GitHub Actions workflow：

### 4.1 `publish-packages.yml` — npm 发布

- 触发条件：推送 `v*` 格式 tag，或手动触发（`workflow_dispatch`）
- 自动将 `workspace:*` 替换为实际版本号后发布 `types`、`utils`、`stdio-to-sse`、`cli`

```bash
# 手动触发发布的流程：
git tag v0.1.2
git push origin v0.1.2
```

### 4.2 `build-android.yml` — Android APK 构建

- 触发条件：推送到 `main` 或 `feat/acp-rn-sync` 分支、PR、手动触发
- 生成 Android release APK 并上传为 artifact

产物：`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

### 4.3 `deploy-web.yml` — Web 部署到 GitHub Pages

- 触发条件：推送 `v*` tag 或手动触发
- 构建 `apps/web`（Vite + React）并部署到 GitHub Pages

---

## 5. 构建产物

### 5.1 CLI 二进制

```bash
bun build ./packages/cli/src/index.ts \
  --compile \
  --outfile hermit-cli
```

产物：单文件可执行程序 `hermit-cli`。

### 5.2 Web 应用

```bash
cd apps/web
bun install
bun run build          # 产物在 dist/ 目录
bun run e2e            # Playwright 端到端测试
```

技术栈：Vite + React 18 + Tailwind CSS + Radix UI + react-markdown + Zustand。

### 5.3 React Native 客户端

iOS Release：

```bash
cd apps/mobile
bun run ios --mode Release
```

产物：

```
ios/build/Products/Release-iphoneos/HermitMobile.app
```

Android Release（本地）：

```bash
cd apps/mobile
bun run android --mode Release
```

产物：

```
android/app/build/outputs/apk/release/app-release.apk
```

> 也可通过 `build-android.yml` workflow 自动构建。

---

## 6. 部署上线

### 6.1 网关服务（CLI Gateway）

#### 配置文件

CLI 读取 `~/.hermit/hermit.config.json`（可通过 `--config` 覆盖），默认值如下：

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

#### 启动网关

```bash
# 使用默认配置和默认 agent
bun packages/cli/src/index.ts start

# 使用自定义 agent 命令
bun packages/cli/src/index.ts start --command npx --args "codex,--acp"

# 打印 Web 客户端预配置链接
bun packages/cli/src/index.ts start --web http://localhost:5180
```

#### 生成配对码

```bash
bun packages/cli/src/index.ts pair
```

输出：配对码、Bearer Token、连接二维码（终端显示）。

#### PM2 守护进程

```bash
pm2 start "bun packages/cli/src/index.ts start" --name hermit-gateway
pm2 save
pm2 startup
```

#### 使用 Mock Agent 开发

```bash
# 方式一：直接用 node 启动
bun packages/cli/src/index.ts start --command node --args "scripts/kimi-mock-agent.js"

# 方式二：将 agent 配置写入 config 文件
```

Mock Agent 路径：`scripts/kimi-mock-agent.js`，支持 JSON-RPC 2.0 协议的 `$/agent/info` 和 `$/prompt` 方法。

#### Docker（最小化）

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 8787
CMD ["bun", "packages/cli/src/index.ts", "start"]
```

```bash
docker build -t hermit-gateway .
docker run -p 8787:8787 hermit-gateway
```

### 6.2 Web 应用部署

```bash
cd apps/web
bun run build          # 产物在 dist/ 目录
bun run preview        # 本地预览
```

CI 中通过 `deploy-web.yml` 自动部署到 GitHub Pages。

### 6.3 React Native 分发

| 阶段 | iOS | Android |
|-------|-----|---------|
| 内测 | TestFlight | Firebase App Distribution |
| 正式 | App Store Connect | Google Play Console |

上传路径：

- iOS：Xcode → Product → Archive → Distribute App
- Android：`android/app/build/outputs/apk/release/app-release.apk` 或通过 Play Console 上传 AAB

### 6.4 环境变量

| 变量 | 用途 | 示例 |
|----------|---------|---------|
| `HERMIT_BRIDGE_URL` | 移动端网关地址 | `http://192.168.1.100:8787` |
| `HERMIT_AGENT_COMMAND` | 网关 agent 命令 | `kimi` |
| `HERMIT_AGENT_ARGS` | 网关 agent 参数 | `acp` |
| `HERMIT_BRIDGE_PORT` | 网关端口 | `8787` |

---

## 7. Web 应用 (`apps/web`)

### 7.1 技术栈

- **构建工具：** Vite 5
- **UI 框架：** React 18 + Tailwind CSS 3
- **组件库：** Radix UI (avatar, checkbox, dialog, dropdown-menu, scroll-area, select, separator, slot, switch, tabs, toast, tooltip)
- **Markdown 渲染：** react-markdown + remark-gfm
- **国际化：** i18next + react-i18next
- **状态管理：** Zustand
- **E2E 测试：** Playwright

### 7.2 开发与构建

```bash
cd apps/web

bun run dev            # 启动开发服务器（默认 localhost:5180）
bun run build          # 生产构建（tsc 检查 + vite build）
bun run preview        # 预览生产构建
bun run e2e            # 运行 E2E 测试
bun run e2e:ui         # E2E 测试 UI 模式
bun run e2e:headed     # E2E 测试浏览器可见模式
bun run e2e:install    # 安装 Playwright 浏览器
```

### 7.3 依赖的 workspace 包

- `@hermit-org/acp`：ACP v1 客户端协议
- `@hermit-org/types`：共享类型定义

---

## 8. 回滚方案

### 8.1 npm 包回滚

24 小时内发错版本：

```bash
npm unpublish @hermit-org/stdio-to-sse@0.1.2 --force
```

超过 24 小时则发布新的 patch 版本：

```bash
npm version patch
npm publish --access public
```

### 8.2 代码回退

回退某个提交：

```bash
git revert <commit-hash>
git push origin main
```

紧急情况下重置到已知 good tag（谨慎使用）：

```bash
git reset --hard v0.1.1
```

### 8.3 热修复流程

```bash
# 从 main 切出
git checkout -b hotfix/sse-timeout
# 修复并提交
git push origin hotfix/sse-timeout
# 提 PR，squash 合并到 main
git tag v0.1.3
git push origin v0.1.3
# 立即发布（CI 自动执行）
```

---

## 9. 兼容性注意事项

### 9.1 Bun 与 React Native Metro

- Bun 能正确安装 React Native 的 `node_modules`，但 Metro 通过 Node 的模块算法解析。
- 如果 Bun 在 peer dependency 或 postinstall 脚本上失败，回退到 npm：
  ```bash
  npm install
  # 或
  bun install --legacy-peer-deps
  ```
- workspace 变更后务必清理 Metro 缓存：
  ```bash
  bun react-native start --reset-cache
  ```

### 9.2 Lockfile 策略

- 仓库中只保留 `bun.lock`。
- 如果存在 `package-lock.json` 或 `pnpm-lock.yaml`，删除它们以避免非确定性安装。

### 9.3 npm Organization

- 首次发布前必须将 `@hermit-org` scope 注册为 npm organization。
- scoped 包默认 private，首次发布必须使用 `--access public`。

### 9.4 环境隔离

- `@hermit-org/stdio-to-sse` 是 Node-only（服务端、网关），不可在 RN/浏览器环境使用。
- `@hermit-org/stdio-to-sse_rn` 是 RN/浏览器专用，不可引入 Node 内置模块。
- `@hermit-org/acp` 是纯协议层，可在任意环境使用。

---

## 10. 常见坑点

| 坑点 | 现象 | 解决方案 |
|---------|---------|-----|
| 发布前未替换 `workspace:*` | `npm publish` 失败 | 发布前改为具体 semver 版本（`^0.1.0`） |
| npm org `@hermit-org` 未创建 | 402 / 权限错误 | 在 npmjs.com 创建 org，或用 `--access public` |
| Bun 安装 RN 依赖失败 | peer dependency / postinstall 报错 | 回退 `npm install` 或 `bun install --legacy-peer-deps` |
| Metro 缓存未清 | `Unable to resolve @hermit-org/types` | `bun react-native start --reset-cache` |
| 版本提升后未重新生成 bun.lock | 安装不一致 | 每次版本变更后执行 `bun install` |
| 网关 SSE 无响应 | 缺少 Authorization header | 使用 `hermit pair` 生成 token，curl 时添加 `-H "Authorization: Bearer <token>"` |
| 端口冲突 | 网关启动失败 | 修改 `hermit.config.json` 中 `gateway.port` 或传入 `--config` 指定其他配置文件 |
| 热修复未打 tag | release 分支混乱 | hotfix 合并后必须打 tag：`git tag v<ver>` |
| `@hermit-org/acp` 被误发布 | 私有包出现在 npm | 该包 `"private": true`，不会被 CI 发布 |

---

## 11. E2E 测试脚本

### 11.1 ACP Kimi 测试

`scripts/test-acp-kimi.ts` 是一个完整的端到端测试脚本，演示如何使用 `@hermit-org/acp` 客户端连接网关：

```bash
bun scripts/test-acp-kimi.ts
```

该脚本执行以下流程：

1. 通过 SSE 连接网关（`http://localhost:8787`）
2. 调用 `initialize` 获取协议版本和 agent 信息
3. 调用 `session/new` 创建会话
4. 调用 `session/prompt` 发送提示并接收流式响应
5. 断开连接

### 11.2 Web E2E

```bash
cd apps/web
bun run e2e
```

使用 Playwright 在 Chromium 中运行端到端测试。
