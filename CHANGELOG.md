# Changelog

本文件记录 Hermit 项目的所有变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

## [0.0.6-alpha.12] - 2026-07-03

### 新增

- **Mobile 功能同步（Web → RN App）**:
  - Settings store 新增 6 个 feature flag（showThoughts/showPlan/showUsageStats/showConfigBar/showRightPanel/acpExt）+ showArchivedSessions
  - 新增 `FeatureGate` 组件用于条件渲染功能模块
  - 新增 `PermissionPanel`：权限请求面板，支持选项选择 + 备注 + 历史记录
  - 新增 `PlanBar`：计划进度条，展开/折叠显示任务列表
  - 新增 `UsageBar`：token 用量与成本显示
  - 新增 `ModeSelector`：会话模式选择器（下拉列表）
  - 新增 `ConfigBar`：agent 配置栏（toggle/select 切换）
  - AcpClientScreen 集成以上组件，支持完整聊天体验
  - SettingsScreen 新增功能开关设置区域
  - GatewayManagerScreen 新增归档会话展示
  - i18n 新增所有功能模块的翻译 key

- **Mobile 单元测试基础设施**:
  - 搭建 Jest + @testing-library/react-native 测试环境
  - 配置 babel-jest + metro-react-native-babel-preset
  - 完整的 react-native mock（解决 Bun `.bun/` 隔离布局下 Flow 语法无法转换的问题）
  - 7 个测试套件、38 个测试用例覆盖 feature flags、settings store、5 个新组件

## [0.0.6-alpha.11] - 2026-07-03

### 修复

- **打字机效果内容不完整**：streaming 阶段每次收到新 chunk 都会重建 interval 定时器，导致加速阶段无法刷新剩余内容。改为通过 ref 追踪最新文本长度，interval 不再因 chunk 到达而重建
- **快捷指令显示为两行**：用户自定义快捷指令和 agent 斜杠命令被拆分到不同容器，合并为同一行并共享「快捷」标签
- **工具调用面板为空**：turn 完成后 `liveTurn` 重置导致工具调用记录消失。改为从 `historyItems` + `liveTurn.toolCalls` 合并提取；右侧面板标签从「right panel」改为「工具面板」
- **归档最后一个会话后未进入空会话**：归档/删除最后一个会话时自动进入 composition mode，显示空的聊天区域而非停留在已归档的会话
- **初始切换 mode UI 不生效**：空会话（composition mode）下 `meta.modes` 为 null 导致 ModeSelector 不渲染。新增 `lastKnownModesRef` 缓存上次 session setup 的 modes，空会话时复用；`currentModeId` fallback 到 `pendingModeRef`
- **刷新会话历史被清空**：`refreshActiveSession` 调用 `sessionLoad` 后无条件用空 buffer 替换 historyItems。改为先处理非 null 返回值（提取 modes/configOptions），再按重放结果设置历史
- **turn 结束不刷新会话列表**：pumpQueue 成功后主动调用 `refreshSessions` 刷新侧边栏
- **Docker 版本号 unknown@0000000**：CI 浅克隆导致 `git describe` 失败。`vite.config.ts` 优先读取 `GITHUB_REF_NAME`/`GITHUB_REF_TYPE` 环境变量；Dockerfile 新增 `APP_VERSION` build-arg
- **Docker 默认工作目录**：agent 进程 cwd 从 `/app` 改为 `/root`（`~`），通过 `--cwd /root` 参数指定

## [0.0.6-alpha.10] - 2026-07-03

### 新增

- **ACP 扩展协议（多 Agent 管理）**:
  - 新增 `@hermit-org/acp-ext` 包，实现非标准 `_agent/*` 扩展协议
  - 支持 agent 的增删改查（`_agent/list`、`_agent/get`、`_agent/create`、`_agent/update`、`_agent/delete`）
  - 支持运行时切换 agent（`_agent/switch`）和重连 agent（`_agent/reload`）
  - 网关直接处理 `_` 前缀方法，不转发给 agent 进程，响应通过 SSE 广播
  - `hermit.config.json` 新增 `agents` 数组与 `activeAgentId` 字段，支持多 agent 配置
  - 设置页新增「Agent 管理」模块（需开启 ACP 扩展功能开关，默认关闭）
  - Web 聊天页工具栏新增 agent 切换下拉框与重连按钮

- **两层连接状态指示**:
  - 底部状态栏显示「网关」连接状态（transport/SSE 层）
  - 顶部连接栏显示「ACP」连接状态（agent initialize 层）
  - 网关接受 SSE 连接后立即通知「网关已连接」，agent initialize 完成后通知「ACP 已连接」

### 变更

- **网关 SSE 连接不再阻塞等待 agent**：客户端请求 SSE 端点后立即建立连接，agent 进程在首次 `/send` 标准 ACP 请求时才按需启动，消除首次连接 30s+ 延迟

### 修复

- **错误横幅关闭按钮无效**：transport 后台重连失败会反复触发同一错误，导致关闭后立即重新弹出。现在记录已关闭的错误消息，同一错误不再重复显示，直到出现新的不同错误

## [0.0.6-alpha.9] - 2026-07-03

### 新增

- **应用图标与 PWA 支持**:
  - 为 Web 客户端添加图标、Apple Touch Icon、manifest，支持 PWA 安装
  - 为 React Native 移动应用配置 Android/iOS 应用图标
  - 设置页面「关于」模块显示项目 Logo 与动态版本号

- **ACP 错误状态管理**:
  - `useAcpClient` 与 `acp-hooks` 新增 `clearError` 方法，用于清除当前错误状态（不影响连接）
  - 设置页等入口在关闭错误提示时同步调用 `clearError`

### 变更

- **构建版本号注入**:
  - Vite 构建时通过 `__APP_VERSION__` 注入版本标签：发布构建使用 git tag，日常构建使用 `<branch>@<short-sha>`

## [0.0.6-alpha.8] - 2026-07-02

### 新增

- **Web 快捷指令**:
  - 在设置页新增「快捷指令」入口，可创建 2-8 字标题、1000 字内容的快捷按钮
  - 点击快捷指令写入消息框，双击可直接发送（可在设置中开启/关闭）
  - 支持单独启用/禁用每个快捷指令

- **网关空闲自动断开 agent**:
  - 当 ACP 无活跃 prompt、SSE 无 `/send` 输入、且 stdout/stderr 静默超过 `gateway.idleTimeout` 时，自动停止 agent 进程
  - gateway HTTP 服务保持运行，下次 SSE 或 `/send` 请求自动重新 spawn agent
  - 新增 `gateway.idleTimeout` 配置项，默认 5 分钟（300000 ms），设置为 `0` 可禁用

### 修复

- **测试环境兼容**：当前环境没有 Node.js，将 `gateway.test.ts` 和 `server.test.ts` 中硬编码的 `node -e` 改为根据环境自动选择 `node` 或 `bun`，并改用真正空闲的端口，避免并发测试冲突
- **Stdout 首行丢失**：`StdioSseServer` 在子进程 spawn 后立即创建 `readline`，防止快速输出的首行丢失

## [0.0.6-alpha.7] - 2026-07-02

### 新增

- **设置分享功能**：
  - 在设置页面新增「分享」入口，可将网关和设置打包为分享链接
  - 使用 URL-safe Base64 编码，零依赖
  - 通过 URL hash（`#s=...`）传递，token 不进入服务器日志
  - 接收方打开链接后自动导入网关（去重）和应用设置
  - payload 携带版本号字段，支持未来格式兼容

## [0.0.6-alpha.6] - 2026-07-02

### 新增

- **TodoList 工具调用 UI 改造**：
  - PlanBar 使用可区分的 Lucide 图标（✅ `CheckCircle2` / 🔄 `Loader2` 旋转 / ○ `Circle`）替代模糊的文本圆点
  - 折叠状态下显示迷你进度条，全部完成时显示绿色对勾
  - 状态变化时图标和文本带过渡动画
  - TodoList 工具调用不再在聊天记录和右侧面板中重复显示（仅保留 PlanBar）

- **AskUserQuestion 工具调用 UI 改造**：
  - 隐藏原始工具名称和 kind 标签，改为对话式问题卡片
  - 已回答的历史记录以用户发言气泡形式展示（右对齐、主题色背景）
  - 用户跳过/取消的问题不再静默消失，记录为灰色「已跳过」气泡
  - 多问题场景以「问题 N」编号展示，避免漏答

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
