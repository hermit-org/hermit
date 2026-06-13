> [English](./README.md) | **中文**

# Hermit

Hermit 是一个基于 Bun 的小型 Monorepo，包含共享包、一个 Bun CLI 和一个 React Native 移动端应用。

## 包与应用

| 工作区 | 路径 | 说明 |
|-----------|------|-------------|
| `@hermit/types` | `packages/types` | 共享 TypeScript 领域类型 |
| `@hermit/utils` | `packages/utils` | 共享 TypeScript 工具函数 |
| `@hermit/cli` | `packages/cli` | 使用 `commander` 构建的 Bun CLI，自动加载 `src/commands` 下的命令 |
| `@hermit/stdio-to-sse` | `packages/stdio-to-sse` | 与协议无关的 stdio ↔ HTTP POST/SSE 桥接库，支持 Node.js 18+ 和 Bun |
| `@hermit/mobile` | `apps/mobile` | 支持国际化的 React Native 移动应用 |

## 技术栈

- **运行时 / 包管理器：** [Bun](https://bun.sh/) `1.3.14`
- **工作区模型：** Bun workspaces（`apps/*`、`packages/*`）
- **语言：** TypeScript（严格模式）
- **CLI：** `commander`
- **移动端：** React Native `0.76.0`、React `18.3.1`、`react-i18next`
- **测试：** `bun:test`

## 快速开始

从仓库根目录安装依赖：

```bash
bun install
```

对整个 Monorepo 进行类型检查：

```bash
bunx tsc --noEmit
```

## CLI

```bash
# 显示帮助
bun packages/cli/src/index.ts --help

# 运行命令
bun packages/cli/src/index.ts start
bun packages/cli/src/index.ts post
bun packages/cli/src/index.ts start web
```

命令会从 `packages/cli/src/commands` 自动发现。详见
[`packages/cli/README.md`](./packages/cli/README.md)。

## stdio-to-sse

`@hermit/stdio-to-sse` 将基于 stdio 的程序桥接到 HTTP POST → SSE 端点。
它有意保持与协议无关，并同时支持 Node.js 18+ 和 Bun。

```bash
cd packages/stdio-to-sse
bun test
```

详见 [`packages/stdio-to-sse/README.md`](./packages/stdio-to-sse/README.md)。

## 移动端

```bash
cd apps/mobile

# 启动 Metro
bun run start

# 运行在 Android / iOS
bun run android
bun run ios
```

Metro 配置会监听 `../../packages`，因此可以直接导入共享的工作区包。

## 仓库结构

```
hermit/
├── package.json              # 根工作区配置
├── tsconfig.json             # 共享 TypeScript 配置
├── bun.lock                  # Bun 锁文件
├── README.md                 # 本文件
├── packages/
│   ├── cli/
│   ├── stdio-to-sse/
│   ├── types/
│   └── utils/
└── apps/
    └── mobile/
```

## 许可证

MIT
