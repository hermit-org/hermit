# Multi-Agent Management — Fixlist

## Scope

本文档覆盖 `_agent/*` 扩展协议从 gateway 到 web client 的完整链路，包括：

- `packages/cli/src/lib/gateway.ts` — agent 进程生命周期
- `packages/cli/src/commands/start/index.ts` — CLI 入口、持久化、`/api/config`
- `packages/cli/src/lib/config.ts` — agents 状态持久化
- `packages/acp-ext/src/client.ts` + `types.ts` — 扩展协议客户端
- `apps/web/src/hooks/useAcpExt.ts` — React hook
- `apps/web/src/pages/RealApp.tsx` — 数据绑定
- `apps/web/src/pages/acp-client-page.tsx` — UI（agent switcher、reload 按钮）
- `apps/web/src/components/templates/SettingsLayout.tsx` → `AgentsSection` — 管理面板
- `apps/web/src/stores/acpClientStore.ts` — 共享 AcpClient
- `apps/web/src/stores/configStore.ts` — `/api/config` 客户端
- `apps/web/src/lib/feature-flags.ts` — `acpExt` feature flag

---

## Bug

### B1 [高] ✅ 切换 agent 时正在运行的 prompt 被静默丢弃

**位置**: `packages/cli/src/lib/gateway.ts:840-877` (`stopAgent`)

**现象**:
```
用户正在和 Agent A 对话（session/prompt 正在处理）
→ 用户切换到 Agent B
→ stopAgent() 被调用
→ agentStoppedIntentionally = true
→ activePrompts.clear()          ← 第 858 行：直接清空
→ proc.kill()                    ← 第 861 行：杀死进程
→ 新 agent 启动成功
```

**问题**:
- `activePrompts` 中的 prompt id 永远不会收到 response
- 客户端没有收到任何 "prompt 被中断" 的事件（没有 SSE error、"prompt/aborted" 通知、也没有 "_agent/changed" 表明中断）
- 聊天 UI 表现为：已发送的消息永久无响应，或流式输出卡在半截

**期望行为**:
- `_agent/switch` 返回之前或切换完成后，通过 SSE 广播一条 "当前会话中的 prompt 已被中断" 的事件，让客户端可以标记未完成的 prompt 为 `interrupted` 状态

---

### B2 [高] ✅ chat transcript 中无 agent 切换标记

**位置**: `apps/web/src/pages/acp-client-page.tsx`、`apps/web/src/pages/RealApp.tsx`

**现象**:
- Agent 切换后，`_agent/changed` 只更新了 `currentAgentId` 状态（`useAcpExt.ts:86-88`）
- `ACPClientPage` 的 `chatItems` 没有任何变化
- 切换前 Agent A 生成的消息和切换后 Agent B 生成的消息混在同一 transcript 中
- 用户看不到任何视觉线索表示 "这条回复来自哪个 agent" 或 "这里发生了 agent 切换"

**期望行为**:
- Transcript 中在 agent 切换点应插入一条系统消息（kind=`system` 或 `context` 类型），标注 "已切换到 Agent B"
- 每条消息应关联 `agentId` 字段（当前 `Message` 类型不包含此字段）

---

### B3 [中] ✅ `/api/config` 的 agents 列表在运行时过期

**位置**: `packages/cli/src/commands/start/index.ts:209-216`

**现象**:
```typescript
// start/index.ts — 只在启动时读取一次
const agents = persisted?.agents ?? configAgents.agents;

// /api/config handler — 永远返回启动时的快照
sendJson(res, 200, {
  agents: agents.map(...),   // ← 运行时 CRUD 不会更新这个变量
  activeAgentId: activeAgent?.id ?? null,
});
```

- Gateway 的 `this.agents` 会随 `_agent/create` / `_agent/delete` 更新，且 `onAgentChanged` → `writeAgentsState` 会持久化到 `~/.hermit/agents.json`
- 但 CLI 层的 `agents` 变量是启动时的快照，`/api/config` 返回的始终是旧数据
- **影响**: 当前 web client 不使用 `/api/config` 的 `agents` 字段（agent 列表来自 `useAcpExt` → `_agent/list`），所以 web 端暂不受影响。但如果 mobile 或其他客户端依赖 `/api/config` 获取 agent 列表，它们会拿到过期数据

**期望行为**:
- Gateway 的 `onAgentChanged` 回调应同时更新 CLI 层的 `agents` 变量，使 `/api/config` 始终返回最新的 agent 列表

---

### B4 [中] ✅ fast consecutive switches cause wasted stop/spawn cycles

**位置**: `packages/cli/src/lib/gateway.ts:573-578` (`doSwitchAgentSerialized`)

**现象**:
```
用户快速点击: A → B → C
→ doSwitchAgentSerialized(B) enqueued
→ doSwitchAgentSerialized(C) enqueued
→ stopAgent()     # for B switch
→ trySpawnAgent() # spawn B
→ stopAgent()     # for C switch — kills B immediately
→ trySpawnAgent() # spawn C
```

- 串行化（`switchPromise`）防止了并发 race，但没有防抖
- B agent 刚被 spawn 就被 C 的切换 kill 了，浪费资源
- 用户看不到任何 "正在切换中" 的 UI 反馈（按钮没有 loading 态）

**期望行为**:
- 客户端侧添加 500ms 防抖，或 gateway 侧在切换过程中忽略新的 switch 请求（目前是串行排队，合理但不是最优）
- 客户端侧 switch/reload 按钮在等待切换完成时应显示 loading 状态

---

### B5 [中] ✅ `_agent/create` auto-activate 时不会立即 spawn agent 进程

**位置**: `packages/cli/src/lib/gateway.ts:457-479`

**现象**:
```typescript
case AcpExtMethod.AgentCreate: {
  ...
  if (this.currentAgentId === null) {
    this.currentAgentId = newAgent.id;
    this.agentCommand = newAgent.command;
    this.agentArgs = newAgent.args ?? [];
    this.agentCwd = newAgent.cwd;
  }
  this.notifyAgentChanged();
  result = { agent: newAgent };
  break;   // ← 没有调用 doSwitchAgentSerialized
}
```

- 此时网关原本没有 agent（`currentAgentId === null`），创建第一个 agent 后只设置了命令参数，没有 spawn 进程
- Agent 只有在下一个 `/send`（带标准 ACP 方法）或 SSE 连接时才通过 `ensureAgentRunning()` 真正启动
- 行为是 lazy spawn，但对用户来说，创建 agent 后如果打开聊天界面，agent switcher 显示了活跃的 agent，但点击发送才启动进程，可能造成微小延迟

**判断**: 这可能是设计如此（lazy spawn 节省资源），但如果后续聊天界面期望创建后立即可用，可能需要改为 auto-spawn

---

### B6 [中] ✅ Settings 中 args 解析不支持含逗号的参数值

**位置**: `apps/web/src/components/templates/SettingsLayout.tsx:798-801`

```typescript
const args = form.args
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
```

**现象**:
- Form 中 args 用逗号分隔的文本输入: `edit` 时用 `.join(", ")` 拼接，`save` 时用 `.split(",")` 切分
- 如果原始 args 包含逗号，如 `["--prompt", "Hello, World"]`:
  - 编辑时 form 显示: `--prompt, Hello, World`
  - 保存时解析为: `["--prompt", "Hello", "World"]` ❌
- 参数值中的逗号被误切分

**期望行为**:
- 使用支持引号的参数解析器（如 `shell-quote` 包的 `parse` / `quote`），或改用逐条输入 + 添加/删除的动态列表 UI

---

## Design Issues

### D1 ✅ settingsStore 中的 `acpExt` 默认值为 `false` 但没有 fallback 逻辑

**位置**: `apps/web/src/stores/settingsStore.ts:110` + `apps/web/src/lib/feature-flags.ts:86`

```typescript
// feature-flags.ts
export const ACP_EXT_FLAG: FeatureFlagDef = {
  key: "acpExt",
  defaultValue: false,   // ← default off
  ...
};

// settingsStore.ts — 初始化
acpExt: false,
```

**现象**: 所有插拔化 feature 中，只有 `acpExt` 默认关闭（实验性功能），其他都默认开启。这是设计意图，没有问题。但：
- `feature-flags.ts` 中 `FEATURE_FLAGS` 数组不包含 `acpExt`（第 37 行注释说明它在 Agent Management section 独立管理）
- `FEATURE_FLAG_DEFAULTS` lookup 因此不包含 `acpExt`
- settingsStore 的初始化需要手动设置 `acpExt: false`
- 如果将来有人不小心在 feature-flags 中添加了 `acpExt`，会导致两个不同的默认值来源

**建议**: 在 `FEATURE_FLAGS` 中包含 `acpExt`，但 UI 渲染时根据 flag 定义做分组（Features section vs Agent Management section），统一默认值来源

---

### D2 ✅ `useAcpExt` 在两个地方被实例化，重复请求和订阅

**位置**: `apps/web/src/pages/RealApp.tsx:120-125` + `apps/web/src/components/templates/SettingsLayout.tsx:748-757`

**现象**:
- `RealApp` 和 `AgentsSection` 各自调用 `useAcpExt(client, acpExtEnabled, transportReady)`
- 共享同一个 `AcpClient`（通过 `acpClientStore`）
- 但各自创建独立的 `AcpExtClient` wrapper、各自发送 `_agent/list` 请求、各自订阅 `_agent/changed` 通知
- 造成 2x 的 `_agent/list` 请求和 2x 的通知处理

**建议**: 将 `useAcpExt` 提升到 `RealApp` 层，通过 context 或 store 向下传递 `agents` / `currentAgentId` / `switchAgent` 等，`AgentsSection` 只消费不发起请求

---

### D3 ✅ agent 切换 UI 没有 loading/busy 状态

**位置**: `apps/web/src/pages/acp-client-page.tsx:409-449`

**现象**:
- Agent switcher dropdown (`Select`) 和 reload 按钮在切换/重载期间没有 visual feedback
- 用户点击后不知道操作是否在进行中
- 切换失败时（所有 agent spawn 失败），系统广播 `"All agents failed to start."` 错误到 SSE，但 UI 层面没有 toast/notice 显式提示

**建议**: 
- 添加 `switching` 状态到 `useAcpExt`，在 switch/reload 期间按钮显示 spinner
- 监听 SSE error 事件并在 UI 中显示错误提示（当前 gateway 通过 SSE `error` event 广播错误）

---

### D4 ✅ `doSwitchAgent` 的 candidates 列表只包含当前已注册的 agents

**位置**: `packages/cli/src/lib/gateway.ts:591-597`

```typescript
const idx = this.agents.findIndex((a) => a.id === agent.id);
const candidates =
  idx >= 0
    ? [...this.agents.slice(idx), ...this.agents.slice(0, idx)]
    : [agent];
```

**现象**: 如果目标 agent 不在 `this.agents` 列表中（`idx === -1`），candidates 只包含该 agent 本身，没有 fallback。这种情况在正常流程中不会出现（`handleExtRequest` 先检查了 `this.agents.find`），但作为防御性编码可用。测试覆盖了这一路径但未验证 `idx === -1` 的场景。

---

## Edge Cases (Low Priority)

### E1 ✅ switch to currently active agent does a no-op kill/respawn

**位置**: `packages/cli/src/lib/gateway.ts:515-526`

- 如果用户切换到的 agent ID 与 `currentAgentId` 相同，仍会走完 `stopAgent()` → `trySpawnAgent()` 完整流程
- 应提前返回或跳过

### E2 ✅ `_agent/delete` 最后一个 agent 后 `agentCommand` 残留

**位置**: `packages/cli/src/lib/gateway.ts:492-513`

```typescript
// 删除最后一个 agent
this.currentAgentId = null;
this.notifyAgentChanged();
void this.stopAgent(false).catch(() => {});
// agentCommand / agentArgs / agentCwd 仍然指向已删除的 agent！
```

- 虽然 `currentAgentId === null` 后新请求不会使用这些值，但残留的脏数据可能在后续 `_agent/create` 时造成混淆

### E3 ✅ `ConfigOptionBar` gated by `showConfigBar` 会隐藏 agent config 选项

**位置**: `apps/web/src/pages/acp-client-page.tsx:484-492`

- `showConfigBar=false` 会隐藏 agent 暴露的 select 类型配置选项（如 model 选择、mode 切换等）
- 如果 agent 的核心功能（如模型选择）只能通过此 bar 调整，隐藏后用户无法配置
- 这与 PLUGGABLE_REFACTOR.md 中 "hiding them would degrade the UX" 的原则不完全一致

---

## Summary

| # | 类型 | 严重度 | 位置 | 简述 | 状态 |
|---|------|--------|------|------|------|
| B1 | Bug | **高** | gateway.ts:858 | 切换 agent 时 in-flight prompt 静默丢弃 | ✅ |
| B2 | Bug | **高** | acp-client-page.tsx | transcript 无 agent 切换标记 | ✅ |
| B3 | Bug | 中 | start/index.ts:209 | `/api/config` agents 列表 runtime 过期 | ✅ |
| B4 | Bug | 中 | gateway.ts:573 | 快速连续切换浪费 stop/spawn | ✅ |
| B5 | Bug | 中 | gateway.ts:478 | `_agent/create` auto-activate 不 spawn | ✅ |
| B6 | Bug | 中 | SettingsLayout.tsx:798 | args 含逗号值解析错误 | ✅ |
| D1 | Design | 低 | feature-flags.ts | `acpExt` 默认值源头分散 | ✅ |
| D2 | Design | 低 | useAcpExt.ts | 重复实例化导致 2x 请求 | ✅ |
| D3 | Design | 低 | acp-client-page.tsx | 切换按钮无 loading/error 反馈 | ✅ |
| D4 | Design | 低 | gateway.ts:591 | candidates fallback 覆盖不完整 | ✅ |
| E1 | Edge | 低 | gateway.ts:515 | switch 到当前 agent 无跳过 | ✅ |
| E2 | Edge | 低 | gateway.ts:499 | 删除最后 agent 后 command 残留 | ✅ |
| E3 | Edge | 低 | acp-client-page.tsx:624 | showConfigBar 可能隐藏关键配置 | ✅ |
