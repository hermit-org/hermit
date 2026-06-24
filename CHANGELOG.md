# Changelog

本文件记录 Hermit 项目的所有变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 新增

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
