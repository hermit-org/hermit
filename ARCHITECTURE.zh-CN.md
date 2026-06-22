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
#     对于 @hermit-org/stdio-to-sse，确认无 workspace:* 依赖残留

# 1.4 npm 发布干跑
bun publish --dry-run

# 1.5 端到端测试桥接
bun packages/cli/src/bin/hermit.ts bridge "cat" --port 3000

# 在另一个终端执行：
curl -N http://localhost:3000/sse              # 应成功连接
curl -X POST http://localhost:3000/message -d "ping"  # SSE 应收到 "ping"
```

所有检查通过后再继续。

---

## 2. 版本管理（独立版本）

Hermit 采用各包独立版本。

### 2.1 版本更新顺序

如果 `@hermit-org/cli` 依赖了新版本 `@hermit-org/stdio-to-sse`，按以下顺序更新和发布：

```
stdio-to-sse → cli → server → mobile
```

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

## 3. npm 发布（`@hermit-org/stdio-to-sse`）

### 3.1 发布前准备

```bash
# 确认无 workspace:* 残留（目前无，但需验证）
grep -R "workspace:\*" packages/stdio-to-sse/package.json

# 登录 npm
npm login

# 确认 npm organization 已存在
npm org ls @hermit-org
```

### 3.2 发布步骤

```bash
cd packages/stdio-to-sse

# 预览发布包
bun publish --dry-run

# 公开发布
bun publish --access public

# 若 bun publish 不可用，使用 npm
npm publish --access public

# 确认版本已上线
npm view @hermit-org/stdio-to-sse versions
```

### 3.3 打 tag

```bash
git tag stdio-to-sse@0.1.2
git push origin stdio-to-sse@0.1.2
```

---

## 4. 构建产物

### 4.1 CLI 二进制

```bash
bun build ./packages/cli/src/bin/hermit.ts \
  --compile \
  --outfile hermit-cli
```

产物：单文件可执行程序 `hermit-cli`。

### 4.2 React Native 客户端

iOS Release：

```bash
cd apps/mobile
bun run ios --mode Release
```

产物：

```
ios/build/Products/Release-iphoneos/HermitMobile.app
```

Android Release：

```bash
cd apps/mobile
bun run android --mode Release
```

产物：

```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 5. 部署上线

### 5.1 桥接服务端

#### 直接运行

```bash
bun apps/server/src/index.ts "cat" 3000
```

#### PM2 守护进程

```bash
pm2 start "bun apps/server/src/index.ts cat 3000" --name hermit-bridge
pm2 save
pm2 startup
```

#### Docker（最小化）

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 3000
CMD ["bun", "apps/server/src/index.ts", "cat", "3000"]
```

```bash
docker build -t hermit-bridge .
docker run -p 3000:3000 hermit-bridge
```

### 5.2 React Native 分发

| 阶段 | iOS | Android |
|-------|-----|---------|
| 内测 | TestFlight | Firebase App Distribution |
| 正式 | App Store Connect | Google Play Console |

上传路径：

- iOS：Xcode → Product → Archive → Distribute App
- Android：`android/app/build/outputs/apk/release/app-release.apk` 或通过 Play Console 上传 AAB

### 5.3 环境变量

| 变量 | 用途 | 示例 |
|----------|---------|---------|
| `HERMIT_BRIDGE_URL` | 移动端桥接地址 | `http://localhost:3000` |
| `HERMIT_AGENT_COMMAND` | 桥接服务端 agent 命令 | `cat` |
| `HERMIT_BRIDGE_PORT` | 桥接服务端端口 | `3000` |
| `HERMIT_LOG_LEVEL` | fastify 日志级别 | `info` |

---

## 6. CI/CD（可选 GitHub Actions）

### 6.1 按 tag 发布

创建 `.github/workflows/publish-stdio-to-sse.yml`：

```yaml
name: Publish stdio-to-sse

on:
  push:
    tags:
      - "stdio-to-sse@*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bunx tsc --noEmit
      - run: cd packages/stdio-to-sse && bun test
      - run: cd packages/stdio-to-sse && bun publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 6.2 PR 验证

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx tsc --noEmit
      - run: cd packages/stdio-to-sse && bun test
```

---

## 7. 回滚方案

### 7.1 npm 包回滚

24 小时内发错版本：

```bash
npm unpublish @hermit-org/stdio-to-sse@0.1.2 --force
```

超过 24 小时则发布新的 patch 版本：

```bash
npm version patch
npm publish --access public
```

### 7.2 代码回退

回退某个提交：

```bash
git revert <commit-hash>
git push origin main
```

紧急情况下重置到已知 good tag（谨慎使用）：

```bash
git reset --hard stdio-to-sse@0.1.1
```

### 7.3 热修复流程

```bash
# 从 main 切出
git checkout -b hotfix/sse-timeout
# 修复并提交
git push origin hotfix/sse-timeout
# 提 PR，squash 合并到 main
git tag stdio-to-sse@0.1.3
git push origin stdio-to-sse@0.1.3
# 立即发布
```

---

## 8. 兼容性注意事项

### 8.1 Bun 与 React Native Metro

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

### 8.2 Lockfile 策略

- 仓库中只保留 `bun.lock`。
- 如果存在 `package-lock.json` 或 `pnpm-lock.yaml`，删除它们以避免非确定性安装。

### 8.3 npm Organization

- 首次发布前必须将 `@hermit-org` scope 注册为 npm organization。
- scoped 包默认 private，首次发布必须使用 `--access public`。

---

## 9. 常见坑点

| 坑点 | 现象 | 解决方案 |
|---------|---------|-----|
| 发布前未替换 `workspace:*` | `bun publish` 失败 | 发布前改为具体 semver 版本 |
| npm org `@hermit-org` 未创建 | 402 / 权限错误 | 在 npmjs.com 创建 org，或用 `--access public` |
| Bun 安装 RN 依赖失败 | peer dependency / postinstall 报错 | 回退 `npm install` 或 `bun install --legacy-peer-deps` |
| Metro 缓存未清 | `Unable to resolve @hermit-org/types` | `bun react-native start --reset-cache` |
| 版本提升后未重新生成 bun.lock | 安装不一致 | 每次版本变更后执行 `bun install` |
| 发布了错误版本 | 生产环境代码错误 | 24h 内 `npm unpublish @hermit-org/stdio-to-sse@<ver> --force` |
| 热修复未打 tag | release 分支混乱 | hotfix 合并后必须打 tag：`git tag <pkg>@<ver>` |
