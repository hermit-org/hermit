# Changelog

本文件记录 Hermit 项目的所有变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

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
