---
name: release
description: Hermit 项目 alpha 测试版本与正式版本发布规范
type: prompt
whenToUse: 当用户要求发布版本、讨论版本号规则、处理 release 相关操作或询问发布策略时
disableModelInvocation: false
---

# Release 规范

发布 Hermit 项目版本时必须遵循以下规则。当前项目仍处于早期迭代阶段，**默认只发布 alpha 测试版本**；正式版本（无后缀稳定版）需要用户明确确认后才可发布。

## 版本类型

| 类型 | 版本号格式 | 来源分支 | 用途 |
|------|------------|----------|------|
| 测试版本 | `0.0.x-alpha.N` | `dev` | 默认发布，日常迭代与功能验证 |
| 正式版本 | `0.0.x` | `main` | 须经用户确认，里程碑稳定版 |

## 版本策略

1. **默认发布 alpha 测试版本**
   - 任何发布请求都先按 `0.0.x-alpha.N` 处理。
   - `x`：按功能或里程碑递增。
   - `N`：按当前 `x` 下的迭代次数递增。
   - 示例：`0.0.3-alpha.8`、`0.0.4-alpha.0`。

2. **正式版本需用户确认**
   - 当前阶段以 alpha 迭代为主，**不主动发布**无后缀稳定版本。
   - alpha 测试版本发布成功后，必须询问用户是否继续发布正式版本。
   - 只有用户明确同意后，才执行合并到 `main`、打 `v0.0.x` tag 并发布。

3. **已误发的历史版本**
   - 已误发的 `v0.0.3`、`v0.0.4`、`v0.0.5` 保留但不作为后续参考。
   - 未来如需处理，使用 `npm deprecate` 并在 release note 中声明。

## 发布前检查清单

- [ ] 当前分支正确：`dev`（测试版）或 `main`（正式版）
- [ ] 对应分支已通过 CI（`build-android.yml`、`deploy-web.yml`、`publish-packages.yml`）
- [ ] 所有 package 的 `package.json` 版本号已同步为待发布版本
- [ ] `CHANGELOG.md` 已更新本次变更
- [ ] 不存在未合并的临时提交或调试代码
- [ ] 如发布正式版，已确认用户明确同意

## 发布流程

### 第一步：发布 alpha 测试版本（默认执行）

1. 确保在 `dev` 分支且已拉取最新代码。
2. 更新所有 `packages/*/package.json` 和 `apps/*/package.json` 版本号为 `0.0.x-alpha.N`。
3. 提交：`chore(release): bump version to 0.0.x-alpha.N`
4. 打 tag：`git tag v0.0.x-alpha.N`
5. 推送 tag：`git push origin v0.0.x-alpha.N`
6. 触发 `publish-packages.yml` 发布到 npm。
7. 在 GitHub Releases 中标记为 **Pre-release**。

### 第二步：询问是否发布正式版本

alpha 测试版本发布成功后，必须向用户提问：

> alpha 测试版本 `0.0.x-alpha.N` 已发布。是否需要继续发布正式版本 `0.0.x`？

- 若用户同意：执行正式版发布流程。
- 若用户拒绝或犹豫：结束本次发布，保持 alpha 状态。

### 第三步：发布正式版本（仅用户确认后）

1. 将 `dev` 合并到 `main`：
   ```bash
   git checkout main
   git pull origin main
   git merge dev
   git push origin main
   ```
2. 在 `main` 分支上确认所有 `package.json` 版本号为 `0.0.x`。
3. 提交：`chore(release): bump version to 0.0.x`
4. 打 tag：`git tag v0.0.x`
5. 推送 tag：`git push origin v0.0.x`
6. 触发 `publish-packages.yml` 发布到 npm。
7. 在 GitHub Releases 中标记为 **Latest**。

## 注意事项

- **不要删除或修改已发布的 npm 版本**，即使发布错误。如需处理，使用 `npm deprecate` 并在 release note 中说明。
- alpha 版本允许破坏性变更，但应在 `CHANGELOG.md` 中说明。
- 禁止从 `feat/*` 临时分支直接打版本 tag 并发布。
