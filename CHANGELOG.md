# Changelog

本文件记录 Hermit 项目的所有变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

## [0.0.6-alpha.5] - 2026-07-02

### 修复

- **TodoList 工具调用后不展示 todo 列表**：Agent（如 Kimi Code）通过 `tool_call` 通道发送 todo 数据（放在 `rawInput` 中），而非走 `plan` session/update 通道，导致 PlanBar 一直为空。现在会从 tool_call 的 `rawInput` 中自动检测 `{todos:[...]}` 格式并同步到 plan 状态，PlanBar 正常渲染。
- **提问工具无法补充说明**：`session/request_permission` 返回结果缺少 `note` 字段，用户无法附带补充说明。现已扩展 `PermissionOutcome` 协议类型新增可选 `note` 字段，贯穿 store → adapter → UI 全链路；每个问题卡片下方新增补充说明输入框，note 会随选项一起传回 agent。

## [0.0.6-alpha.4] - 2026-07-02

### 新增

- **Web 打字机效果**：智能体回复以逐字打字效果显示
  - 流式输出时逐字渲染 markdown 内容，而非一次性渲染全文
  - 收到结束信号后自动加速刷新剩余内容（加速倍率可配置）
  - 在设置页面「外观」区域可配置：开关、显示速度、刷新间隔、加速倍率

### 修复

- **Web ACP 协议详情面板**：不再展示 agent 不支持的操作（如 `session/close`）
- **Web 斜杠命令菜单**：输入 `/` 打开命令菜单时按 Enter 现在选择命令而非直接发送消息
- **Web 新建会话状态栏**：点击新建后保留模式选择器和配置栏，不再清除状态栏
- **Web 新建会话流程**：先创建会话 → 再设置模式 → 最后发送消息，模式选择在编辑模式下缓存

## [0.0.6-alpha.3] - 2026-07-02

### 新增

- **Web 端到端自动化测试**：基于 Playwright 覆盖核心用户流程
  - 支持无头（`bun run e2e`）与有头（`bun run e2e:headed`）两种运行模式
  - 新增 mock ACP agent 与 SSE gateway fixture，测试无需真实 CLI 网关
  - 覆盖网关添加/列出流程与进入会话并发送消息的聊天流程
  - 在页面与组件中补充 `data-testid` 等稳定选择器，不改动业务逻辑

## [0.0.6-alpha.2] - 2026-06-25

### 新增

- **Web 桌面通知**：回复完成后可发送浏览器桌面通知

### 修复

- **Web 设置页返回**：返回时保持 `RealApp` 挂载，避免状态丢失

## [0.0.6-alpha.1] - 2026-06-25

### 变更

- **Web 右侧面板改为可插拔功能**：将「显示右侧面板」从外观设置移至「可插拔功能」模块
  - 接入统一的 FeatureFlag + `withFeatureGate` HOC 体系，与其他功能开关一致
  - 默认关闭；关闭后右侧面板及其折叠/展开按钮一并隐藏，不再出现「面板隐藏但按钮残留」的问题
  - 新增特性开关 `showRightPanel`（`feature-flags.ts`），设置页功能模块自动渲染开关

- **docker-compose 改为拉取远程镜像**：不再本地构建，直接拉取 GHCR 预构建镜像

## [0.0.6-alpha.0] - 2026-06-25

### 新增

- **Docker 容器化部署**：提供单一自包含镜像，一个容器同时运行网关与 Web 客户端
  - 新增 `Dockerfile`（all-in-one）：基于 `node:20-slim`，内置 Node/Bun/nginx/supervisor
    - 网关由 `supervisord` 管理，Web 客户端经 nginx 提供 SPA 服务（配置内联，无额外文件）
    - 内置 `node`、`npm`、`npx`、`bun`、`bunx`，默认 `npx codex --acp` 即可直接运行
    - 配对令牌通过 `/root/.hermit` 卷持久化，`hermit.config.json` 可挂载覆盖
  - 新增 CI 流程 `.github/workflows/docker-publish.yml`：自动构建并推送镜像到 GHCR（`ghcr.io/hermit-org/hermit`）
    - `push tag v*` 触发：`v1.2.3` → `1.2.3`/`1.2`/`1`/`latest`；预发布 `v1.2.3-beta.1` → `1.2.3-beta.1`（不打 latest）
    - `workflow_dispatch` 手动触发：默认打 `dev` 标签（可自定义，用于测试包）
    - 多架构构建（`linux/amd64` + `linux/arm64`），启用 GHA 构建缓存
  - 新增 `.dockerignore`

- **CORS 细粒度配置**：网关支持通过命令行参数和配置文件自定义跨域规则
  - 配置文件 `hermit.config.json` 的 `gateway.cors` 现在支持三种写法：
    - `true`（默认）：允许所有来源
    - `false`：完全禁用 CORS
    - 对象形式：`{ "origins": [...], "methods": [...], "headers": [...] }`
  - 命令行新增 `--cors <value>` 参数：
    - `--cors '*'` 或 `--cors true`：允许所有来源
    - `--cors false`：禁用 CORS
    - `--cors "http://localhost:5180,https://example.com"`：限制为指定来源
  - 当配置了特定来源时，响应会根据请求的 `Origin` 头进行精确匹配并回显，同时添加 `Vary: Origin`

### 示例

配置文件方式：

```json
{
  "gateway": {
    "cors": {
      "origins": ["http://localhost:5180", "https://hermit.app"],
      "methods": ["GET", "POST", "OPTIONS"],
      "headers": ["Content-Type", "Authorization"]
    }
  }
}
```

命令行方式：

```bash
# 仅允许 Web 客户端来源
hermit start --cors "http://localhost:5180"

# 禁用 CORS
hermit start --cors false
```

- **Web 可插拔功能开关**：新增特性开关系统与设置面板
  - 新增 `src/lib/feature-flags.ts` 集中注册特性开关
  - 新增 `FeatureGate` / `withFeatureGate` / `useFeatureFlag` 能力
  - 思考过程、计划条、配置项、用量统计等可通过设置开启/关闭
  - 设置页新增 Features 分区与 About 页面

- **Web 体验优化**：图片粘贴、右侧面板默认隐藏、归档显示开关、网关列表优先

### 修复

- **移动端录入网关后闪退**
  - 升级 `react-native-mmkv` 到 `3.3.3`，兼容 React Native 0.76 New Architecture
  - 修正 MMKV encryption key 为 16 字节以内，避免 Native 初始化失败
  - `gatewayStore` / `settingsStore` 的 persist storage 增加 try-catch，防止脏数据/写失败导致崩溃
  - RN SSE transport 改用 `react-native-sse` 静态导入，避免 Metro 动态导入异常
  - `useAcpClient` 增加 `client` state，创建 transport/client 过程增加错误处理
  - 网关管理页增加 URL 必须以 `http/https` 开头的校验，`addGateway` 加 try-catch
  - `createMobileTransport` 仅在 token 非空时发送 `Authorization` 头
