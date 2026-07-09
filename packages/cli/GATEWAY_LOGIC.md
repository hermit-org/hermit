# Hermit CLI Gateway 逻辑梳理

本文档结合 `packages/cli/src/lib/gateway.ts` 的实现与 `packages/cli/src/lib/gateway.test.ts` 的测试用例，梳理 `AcpGatewayServer` 的核心行为、状态流转与边界处理。

---

## 1. 概述

`AcpGatewayServer` 是一个**协议无关**的 stdio ↔ SSE 网桥：

- 启动一个本地子进程作为 agent（stdio）。
- 对外暴露 HTTP 服务，提供：
  - `GET/POST /`：SSE 流，转发 agent 的 stdout。
  - `POST /send`：将请求体写入 agent 的 stdin；`_`-prefixed 的扩展方法由网关自己处理。
  - `GET /qr`：返回配对二维码图片（可选）。
- 支持多 agent 配置，通过 `_agent/*` 扩展协议在运行时切换、创建、更新、删除 agent。

> 对应源码：`packages/cli/src/lib/gateway.ts` 第 89–975 行。  
> 对应测试：`packages/cli/src/lib/gateway.test.ts`。

---

## 2. 核心状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `server` | `Server` | Node.js HTTP 服务实例。 |
| `proc` | `ChildProcess` | 当前运行的 agent 子进程。 |
| `connections` | `Set<ActiveConnection>` | 活跃的 SSE 连接集合。 |
| `stdinWriteQueue` | `Array<{chunk, resolve, reject}>` | 串行写入 stdin 的任务队列。 |
| `stdinWriting` | `boolean` | 是否正在刷新 stdin 队列。 |
| `started` | `boolean` | `start()` 是否已调用。 |
| `procExited` | `boolean` | 当前 agent 进程是否已退出。 |
| `cors` | `NormalizedCors` | 规范化后的 CORS 配置。 |
| `idleTimeout` | `number` | 空闲超时毫秒数，`0` 表示禁用。 |
| `lastActivityAt` | `number` | 最后一次活动时间戳。 |
| `activePrompts` | `Set<string \| number>` | 当前未完成的 `session/prompt` 请求 id。 |
| `idleCheckTimer` | `Timer` | 空闲检查定时器。 |
| `spawnPromise` | `Promise<void>` | 当前 respawn 的序列化 Promise。 |
| `agentStoppedIntentionally` | `boolean` | 标记进程是否被网关主动停止，用于区分意外退出。 |
| `agents` | `AgentConfig[]` | 所有已配置 agent。 |
| `currentAgentId` | `string \| null` | 当前激活的 agent id。 |
| `pendingStdinBuffers` | `Buffer[]` | 进程未就绪时缓冲的 stdin 数据。 |
| `procReady` | `boolean` | agent stdin 是否可写（由 `setImmediate` 或第一条 stdout 触发）。 |
| `switchPromise` | `Promise<void>` | 串行化 agent switch/reload 操作。 |

> 对应源码：`gateway.ts:90–118`。  
> 对应测试：各状态通过端到端测试间接验证，如 idle timeout 测试 `gateway.test.ts:734`。

---

## 3. HTTP 端点路由

路由在 `start()` 中通过 `createServer` 注册（`gateway.ts:157–202`）：

1. **`OPTIONS` 请求**：若 CORS 启用，返回 204 预检响应。  
   - 测试：`gateway.test.ts:416–478`。
2. **`GET/POST /`**：调用 `handleSseRequest`，建立 SSE 连接。  
   - 测试：`gateway.test.ts:148–165`。
3. **`POST /send`**：调用 `handleSendRequest`，写入 stdin 或处理扩展方法。  
   - 测试：`gateway.test.ts:167–195`、`gateway.test.ts:590–615`、`gateway.test.ts:874–915`。
4. **`GET /qr`**：调用 `handleQrRequest`，返回二维码 PNG。  
   - 测试：`gateway.test.ts:618–689`。
5. **未匹配路径**：返回 404。  
   - 测试：`gateway.test.ts:197–212`。

### 3.1 路径规范化

- `endpoint === "/"` 时保持 `/`。
- 其他 endpoint 会去掉末尾的 `/`。
- `sendEndpoint` 与 `qrEndpoint` 同样去掉末尾 `/`。

> 对应源码：`gateway.ts:150–152`。  
> 对应测试：`gateway.test.ts:306–323`。

### 3.2 URL 构建

- 绑定 `0.0.0.0` 时，对外 URL 使用 `localhost`。  
  - 测试：`gateway.test.ts:289–304`。
- 自定义 `hostname` 与 `endpoint` 时按配置拼接。  
  - 测试：`gateway.test.ts:271–287`。

### 3.3 `onRequest` Hook

- 若 `onRequest` 返回 `true`（或 async 返回 `true`），短路默认路由。  
  - 测试：`gateway.test.ts:326–351`、`gateway.test.ts:392–413`。
- 若返回 `false`，继续默认路由。  
  - 测试：`gateway.test.ts:353–369`。
- 若抛出异常，返回 500 并附带错误消息。  
  - 测试：`gateway.test.ts:371–390`。

---

## 4. SSE 连接管理

### 4.1 建立连接

`handleSseRequest`（`gateway.ts:312–343`）：

- 立即写入 SSE 响应头，**不等待 agent 启动**。
- 设置 `Content-Type: text/event-stream` 与 CORS 头。
- 注册心跳定时器，按 `heartbeatInterval` 发送 keep-alive comment frame。
- 将连接加入 `connections`。
- 监听 `res.close`，断开时清理。

> 对应测试：`gateway.test.ts:480–499`（心跳）、`gateway.test.ts:522–547` / `549–572`（进程退出后 SSE 仍保持）。

### 4.2 心跳

- 使用 `encodeSseKeepAlive()` 生成 `: \n\n` 形式的 comment frame。
- 定时器会在 `res.writableEnded` 时跳过写入。

> 对应源码：`gateway.ts:330–334`。  
> 对应测试：`gateway.test.ts:480–499`。

### 4.3 连接清理

`removeConnection`（`gateway.ts:937–944`）：

- 从 `connections` 中删除。
- 清除心跳定时器。
- 若响应未结束，调用 `res.end()`。

---

## 5. Agent 进程生命周期

### 5.1 首次启动

`start()` 在 HTTP server 监听成功后调用 `spawnAgent(command, args, cwd)`（`gateway.ts:208`）。

### 5.2 子进程创建

`spawnAgent`（`gateway.ts:225–310`）：

- 使用 `spawn` 创建子进程，`stdio: ["pipe", "pipe", "pipe"]`。
- 记录 `agentCommand`、`agentArgs`、`agentCwd`。
- 重置 `procExited = false`、`procReady = false`、`agentStoppedIntentionally = false`。
- `setImmediate` 后若进程仍存活，设置 `procReady = true` 并 flush 缓冲数据。
- 监听 `proc.error`：标记退出，广播错误。  
  - 测试：`gateway.test.ts:574–588`。
- 监听 `proc.exit`：标记退出，若非主动停止则广播错误，停止 idle check，**不关闭 SSE 连接**。  
  - 测试：`gateway.test.ts:522–547`、`549–572`。

### 5.3 stdout 处理

通过 `readline.createInterface` 按行读取 stdout（`gateway.ts:276–297`）：

- 每收到一行：记录活动、设置 `procReady = true`、flush 缓冲、广播该行。
- 第一条 stdout 行也会把 `procReady` 置为 true。

> 对应测试：所有 SSE 流测试，如 `gateway.test.ts:148–165`、`167–195`。

### 5.4 stderr 处理

`proc.stderr.on("data")`（`gateway.ts:298–309`）：

- 将 stderr 按行分割，非空行作为 `error` 事件广播。

> 对应测试：`gateway.test.ts:502–520`。

### 5.5 确保 Agent 运行

`ensureAgentRunning`（`gateway.ts:747–765`）：

- 若进程存活且未退出，直接返回。
- 若正在 respawn，等待 `spawnPromise`。
- 否则启动 respawn，设置 `spawnPromise`，完成后清空。

### 5.6 尝试启动并判断是否成功

`trySpawnAgent`（`gateway.ts:806–838`）：

- 调用 `spawnAgent`。
- 轮询 `procReady`（50ms），成功返回 `true`。
- 监听 `proc.error` / `proc.exit`，失败返回 `false`。
- 超时（默认 10s）返回 `false`。

> 设计说明：不创建第二个 `readline` 与 `spawnAgent` 竞争 stdout。  
> 对应测试：`gateway.test.ts:918–983`（auto-fallback）。

---

## 6. Stdin 写入与缓冲

### 6.1 `/send` 处理流程

`handleSendRequest`（`gateway.ts:345–400`）：

1. 读取请求体。
2. `splitExtLines` 将请求体拆分为：
   - `extLines`：JSON-RPC 2.0 且方法名为 `_`-prefixed 的扩展请求。
   - `stdLines`：其他行（转给 agent）。
3. 先处理 `extLines`。
4. 若 `stdLines` 非空：
   - 调用 `ensureAgentRunning()` 触发 respawn（不 await）。
   - 合并 `stdLines` 为 Buffer。
   - 调用 `trackPromptRequestFromBody` 追踪 `session/prompt`。
   - 若 `isStdinReady()` 为 true，立即写入并返回 200。
   - 否则加入 `pendingStdinBuffers`，返回 202（`queued: true`）。
5. 若只有扩展方法，返回 200。

> 对应测试：`gateway.test.ts:167–195`（立即写入）、`gateway.test.ts:590–615`（不可 spawn 时返回 202）、`gateway.test.ts:874–915`（延迟启动时仍成功交付）。

### 6.2 stdin 就绪条件

`isStdinReady`（`gateway.ts:768–777`）：

```text
proc 存在 && 未 killed && 未 exited && stdin 存在 && stdin 未 destroyed && procReady
```

### 6.3 串行写入队列

`writeToStdin` / `flushStdinQueue`（`gateway.ts:879–917`）：

- 所有写入通过 `stdinWriteQueue` 串行化。
- 使用 `stdin.write` 的回调 + `drain` 事件处理背压。
- 若写入时 stdin 不可用，reject 错误。

### 6.4 缓冲数据 flush

`flushPendingStdin`（`gateway.ts:780–794`）：

- 合并所有 pending buffer。
- 若 stdin 就绪则写入；否则重新放回 pending 队列。

> 对应源码：`gateway.ts:247–252`、`288–289`、`780–794`。  
> 对应测试：`gateway.test.ts:874–915`。

---

## 7. Idle Timeout

### 7.1 机制

- `idleTimeout` 默认 300000ms（5 分钟），`0` 禁用。
- `startIdleCheck` 每 `min(5000, max(100, idleTimeout/2))` 毫秒检查一次。
- 触发条件：
  - 没有 active prompts（`activePrompts.size === 0`）。
  - 距离 `lastActivityAt` 超过 `idleTimeout`。
- 触发后调用 `stopAgent()` 停止 agent，HTTP server 保持运行。

### 7.2 活动记录

以下行为会更新 `lastActivityAt`：

- `spawnAgent` 成功启动。
- 收到 stdout 行。
- 收到 stderr 数据。
- `/send` 写入 stdin 或 buffering 时。

### 7.3 Prompt 追踪

- `trackPromptRequestFromBody`：在 `/send` 体中查找 `session/prompt` 请求，将其 `id` 加入 `activePrompts`。
- `handleAgentStdoutLine`：收到对应 `id` 的 `result` 或 `error` 响应时，从 `activePrompts` 删除。

> 对应测试：`gateway.test.ts:734–789`（超时停止并 respawn）、`gateway.test.ts:791–845`（active prompt 阻止超时）、`gateway.test.ts:847–871`（禁用超时）。

---

## 8. 多 Agent 扩展协议（`_agent/*`）

扩展请求由 `handleExtRequest` 统一处理（`gateway.ts:432–555`），响应通过 SSE 广播。

### 8.1 `_agent/list`

返回所有 agent 与当前 active id。  
测试：`gateway.test.ts:1086–1121`。

### 8.2 `_agent/get`

按 `agentId` 返回单个 agent，不存在返回错误。  
测试：`gateway.test.ts:1123–1148`（正常）、`1149–1173`（不存在）。

### 8.3 `_agent/current`

返回 `currentAgentId`。  
测试：`gateway.test.ts:1175–1198`。

### 8.4 `_agent/create`

- 要求 `agent.command`。
- 若未指定 `id` 则生成唯一 id（`agent-1`、`agent-2`...）。
- 默认 `name` 为 `id` 或 `command`。
- 若当前没有 active agent，自动激活新 agent 并更新 command/args/cwd。
- 广播 `_agent/changed`。

测试：`gateway.test.ts:1393–1426`（创建）、`1428–1464`（自动激活）。

### 8.5 `_agent/update`

- 要求 `agent.id`。
- 用传入对象完全替换原 agent（注意：是完整替换，不是合并）。
- 广播 `_agent/changed`。

测试：`gateway.test.ts:1467–1500`。

### 8.6 `_agent/delete`

- 要求 `agentId`。
- 删除后调整 `currentAgentId`：
  - 若删除的是 active agent，切换到列表中的下一个 agent；没有则置为 `null` 并停止进程。
- 广播 `_agent/changed`。

测试：`gateway.test.ts:1503–1559`（删除非 active）、`1561–1614`（删除 active 自动切换）、`1616–1657`（删除最后一个）。

### 8.7 `_agent/switch`

- 要求 `agentId`。
- 校验 agent 存在后，**立即返回 200**，实际的 stop/respawn 在后台通过 `doSwitchAgentSerialized` 异步执行。
- 切换进度通过 `_agent/changed` 与错误广播推送到 SSE。

测试：`gateway.test.ts:1203–1252`（正常切换）、`1254–1277`（不存在）、`1279–1340`（并发序列化）。

### 8.8 `_agent/reload`

- 对当前 `currentAgentId` 对应的 agent 重新执行 stop/respawn。
- 立即返回，异步执行。

测试：`gateway.test.ts:1343–1391`。

### 8.9 Agent 切换的 fallback 与恢复

`doSwitchAgent`（`gateway.ts:585–639`）：

1. 构建候选列表：从目标 agent 开始，循环遍历所有 agent。
2. 保存 `originalAgentId`。
3. 停止当前 agent。
4. 遍历候选：
   - 若存在 SSE 连接，尝试 `trySpawnAgent`。
   - 成功则提交 `currentAgentId`，启动 idle check，返回。
   - 失败则广播错误，继续下一个候选。
   - 若无 SSE 连接，直接更新 `currentAgentId` 而不 spawn。
5. 全部失败则恢复 `originalAgentId`，广播 "All agents failed"。

> 序列化控制：`doSwitchAgentSerialized`（`gateway.ts:573–578`）通过 `switchPromise` 链保证并发 switch/reload 串行执行。  
> 对应测试：`gateway.test.ts:918–983`（fallback）、`1279–1340`（并发序列化）、`1662–1708`（全部失败后恢复）。

---

## 9. 错误广播

- `broadcast(payload)`：将普通数据封装为 SSE data frame，发给所有连接。
- `broadcastError(message)`：封装为 `event: error` frame 广播。
- 触发场景：
  - agent spawn 失败。
  - agent 意外退出。
  - agent stderr 输出。
  - 扩展方法执行失败（通过 SSE 返回 JSON-RPC error，非 `broadcastError`）。

> 对应源码：`gateway.ts:919–935`。  
> 对应测试：`gateway.test.ts:502–520`、`522–547`、`549–572`、`574–588`、`918–983`、`1662–1708`。

---

## 10. 停止与清理

### 10.1 `stopAgent(closeConnections?)`

`gateway.ts:840–877`：

- 默认 `closeConnections = true`。
- 停止 idle check。
- 若 `closeConnections` 为 true，关闭所有 SSE 连接。
- 清空 `pendingStdinBuffers`。
- 若进程仍在运行：
  - `agentStoppedIntentionally = true`。
  - 清空 `activePrompts`。
  - 发送 `SIGTERM`。
  - 5s 内未退出则发送 `SIGKILL`。
- 清理 `proc` 引用。

> 对应测试：`gateway.test.ts:691–704`（优雅停止）、`706–730`（SIGKILL 回退）。

### 10.2 `stop()`

`gateway.ts:966–974`：

- 停止 idle check。
- `await stopAgent()`。
- 关闭 HTTP server 与所有连接。

> 对应测试：几乎每个测试的 `finally` 块都会调用。

### 10.3 重复停止

`stop()` 可安全重复调用，不会抛错。  
测试：`gateway.test.ts:691–704`。

---

## 11. 测试用例映射表

| 功能域 | 测试位置 | 主要验证点 |
|--------|----------|-----------|
| 基本 SSE 流 | `gateway.test.ts:148–165` | agent stdout 立即通过 SSE 推送。 |
| `/send` stdin → stdout | `gateway.test.ts:167–195` | POST /send 的数据被写入 stdin，并通过 SSE 回显。 |
| 404 路由 | `gateway.test.ts:197–212` | 未匹配路径返回 404。 |
| CORS 预检 | `gateway.test.ts:214–230` | OPTIONS 返回 204 与 `*` origin。 |
| 自定义 hostname/endpoint | `gateway.test.ts:271–304` | URL 正确拼接，0.0.0.0 显示为 localhost。 |
| 路径去尾斜杠 | `gateway.test.ts:306–323` | `/send/`、`/qr/` 可用。 |
| `onRequest` hook | `gateway.test.ts:326–413` | 返回 true 短路、false 继续、抛错返回 500、支持 async。 |
| CORS 禁用/特定 origin | `gateway.test.ts:416–478` | 禁用后 OPTIONS 404；特定 origin 回显并设置 Vary。 |
| SSE 心跳 | `gateway.test.ts:480–499` | 按配置间隔发送 comment keep-alive。 |
| stderr 广播 | `gateway.test.ts:502–520` | stderr 行作为 error 事件广播。 |
| agent 退出（code） | `gateway.test.ts:522–547` | 广播错误，SSE 保持。 |
| agent 退出（signal） | `gateway.test.ts:549–572` | 广播 signal 错误，SSE 保持。 |
| spawn 错误 | `gateway.test.ts:574–588` | 网关不崩溃，stop 正常。 |
| `/send` 202 缓冲 | `gateway.test.ts:590–615` | agent 无法 spawn 时仍接受数据并返回 202。 |
| `/qr` 端点 | `gateway.test.ts:618–689` | 未配置 404、null 404、配置正确返回 PNG。 |
| 优雅停止 | `gateway.test.ts:691–704` | 重复 stop 安全。 |
| SIGKILL 回退 | `gateway.test.ts:706–730` | 忽略 SIGTERM 的进程被强制杀死。 |
| idle timeout 停止与 respawn | `gateway.test.ts:734–789` | 超时停止 agent，下次 /send 重新 spawn。 |
| active prompt 阻止 timeout | `gateway.test.ts:791–845` | 未完成的 prompt 使 agent 保持运行。 |
| 禁用 idle timeout | `gateway.test.ts:847–871` | `idleTimeout: 0` 时 agent 持续运行。 |
| non-blocking /send | `gateway.test.ts:874–915` | agent 延迟启动时 /send 不阻塞，数据最终送达。 |
| agent auto-fallback | `gateway.test.ts:918–983` | switch 到 bad agent 后自动 fallback 到 good agent。 |
| `_agent/list/get/current` | `gateway.test.ts:1086–1198` | 返回配置与当前 agent。 |
| `_agent/switch` | `gateway.test.ts:1203–1340` | 切换、不存在报错、并发序列化。 |
| `_agent/reload` | `gateway.test.ts:1343–1391` | 重启当前 agent。 |
| `_agent/create` | `gateway.test.ts:1393–1464` | 创建 agent、自动激活。 |
| `_agent/update` | `gateway.test.ts:1467–1500` | 更新 agent 元数据。 |
| `_agent/delete` | `gateway.test.ts:1503–1657` | 删除非 active、删除 active 切换、删除最后一个停止进程。 |
| switch all-fail 恢复 | `gateway.test.ts:1662–1708` | 所有候选 spawn 失败后恢复 original agent id。 |

---

## 12. 关键设计决策

1. **SSE 优先，agent 懒启动**：`handleSseRequest` 不等待 agent 启动，客户端可先收到连接成功状态。agent 实际在 `/send` 时确保运行。  
   - 测试：`gateway.test.ts:874–915`。
2. **进程退出不关闭 SSE**：gateway 作为长期服务，agent 崩溃后可自动恢复，连接保持。  
   - 测试：`gateway.test.ts:522–572`。
3. **stdin 写入串行化**：通过 `stdinWriteQueue` 避免并发写入导致的数据错乱。  
   - 代码：`gateway.ts:879–917`。
4. **agent 切换串行化**：`switchPromise` 链保证并发 switch/reload 顺序执行，避免状态竞争。  
   - 测试：`gateway.test.ts:1279–1340`。
5. **switch 失败自动 fallback**：当目标 agent 无法启动时，按配置顺序尝试其他 agent，全部失败后恢复原始 agent。  
   - 测试：`gateway.test.ts:918–983`、`1662–1708`。
