# syntax=docker/dockerfile:1
#
# Hermit all-in-one image (gateway + web client, single container).
#
#   Build:  docker build -t hermit .
#   Run:    docker run -d -p 8787:8787 -p 5180:80 \
#             -v ./hermit.config.json:/app/hermit.config.json:ro \
#             -v hermit-data:/root/.hermit hermit
#
# Override the agent by editing hermit.config.json (mountable).

# ============================================================================
# Base: Node.js 22 + Bun (runtime) + nginx + supervisor + kimi CLI
# Node 22+ is required by @moonshot-ai/kimi-code.
# ============================================================================
FROM node:22-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g bun @moonshot-ai/kimi-code
WORKDIR /app

# ----------------------------------------------------------------------------
# Build the web client (static SPA)
# ----------------------------------------------------------------------------
FROM base AS web-build

# Pass the version label into the build (tag-push CI sets GITHUB_REF_NAME).
# Falls back to git if available, or "unknown" in plain docker builds.
ARG APP_VERSION=""
ENV GITHUB_REF_TYPE="${APP_VERSION:+tag}"
ENV GITHUB_REF_NAME="${APP_VERSION}"

COPY package.json bun.lock tsconfig.json ./
COPY packages/acp/package.json            packages/acp/
COPY packages/acp-hooks/package.json      packages/acp-hooks/
COPY packages/acp-ext/package.json        packages/acp-ext/
COPY packages/cli/package.json            packages/cli/
COPY packages/stdio-to-sse/package.json   packages/stdio-to-sse/
COPY packages/stdio-to-sse_rn/package.json packages/stdio-to-sse_rn/
COPY packages/types/package.json          packages/types/
COPY packages/utils/package.json          packages/utils/
COPY apps/web/package.json                apps/web/
# NOTE: 不能用 --frozen-lockfile：bun.lock 包含 apps/mobile 等未复制的
# workspace，frozen 模式会因 workspace 缺失而校验失败。普通 install 会基于
# 实际存在的 workspace 正确解析（仍优先使用锁定的版本）。
RUN bun install

COPY packages/ packages/
COPY apps/web/ apps/web/
RUN cd apps/web && bun run build

# ----------------------------------------------------------------------------
# Final image: gateway runtime + served web client
# ----------------------------------------------------------------------------
FROM base AS final

# Install gateway dependencies (runtime only).
COPY package.json bun.lock tsconfig.json ./
COPY packages/acp/package.json            packages/acp/
COPY packages/acp-hooks/package.json      packages/acp-hooks/
COPY packages/acp-ext/package.json        packages/acp-ext/
COPY packages/cli/package.json            packages/cli/
COPY packages/stdio-to-sse/package.json   packages/stdio-to-sse/
COPY packages/stdio-to-sse_rn/package.json packages/stdio-to-sse_rn/
COPY packages/types/package.json          packages/types/
COPY packages/utils/package.json          packages/utils/
COPY apps/web/package.json                apps/web/
RUN bun install

COPY packages/ packages/
COPY hermit.config.json ./

# Web build output -> served by nginx.
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html

# ---- nginx: SPA fallback (inline config, no extra file) ----
COPY <<'EOF' /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# ---- supervisord: run gateway + nginx in one container ----
COPY <<'EOF' /etc/supervisor/conf.d/hermit.conf
[supervisord]
nodaemon=true
logfile=/dev/null
pidfile=/tmp/supervisord.pid

[program:gateway]
command=bun packages/cli/src/index.ts start --config /app/hermit.config.json --cwd /root
directory=/app
autorestart=true
priority=10
stdout_logfile=/proc/1/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/proc/1/fd/2
stderr_logfile_maxbytes=0

[program:web]
command=nginx -g "daemon off;"
autorestart=true
priority=20
stdout_logfile=/proc/1/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/proc/1/fd/2
stderr_logfile_maxbytes=0
EOF

ENV HERMIT_CONFIG=/app/hermit.config.json
VOLUME ["/root/.hermit"]

EXPOSE 8787 80

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/hermit.conf"]
