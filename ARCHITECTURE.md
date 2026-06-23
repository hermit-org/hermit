> **English** | [中文](./ARCHITECTURE.zh-CN.md)

# Hermit Release & Deployment Guide

## 1. Pre-release Verification (Local)

Run these checks before any publish or deploy action.

```bash
# 1.1 Install and link workspaces
bun install

# 1.2 Type-check the whole monorepo
bunx tsc --noEmit

# 1.3 Update version numbers in affected package.json files.
#     For publishable packages, ensure workspace:* deps are resolved before npm publish.

# 1.4 Dry-run npm publish
bun publish --dry-run

# 1.5 Test the gateway end-to-end
bun packages/cli/src/index.ts start

# In another terminal:
curl -N -H "Authorization: Bearer <token>" http://localhost:8787/   # should connect to SSE
curl -X POST -H "Authorization: Bearer <token>" http://localhost:8787/send -d '{"jsonrpc":"2.0","method":"$/agent/info","id":1}'  # should receive response via SSE
```

All checks must pass before proceeding.

---

## 2. Version Management (Independent Versions)

Hermit uses independent versioning per package.

### 2.1 Publishable Packages

The following packages are published to npm (in the specified order):

```
types → utils → stdio-to-sse → cli
```

`@hermit-org/stdio-to-sse_rn`, `@hermit-org/acp`, `@hermit-org/mobile`, and `@hermit-org/web` are private and not published.

### 2.2 Bumping Versions

```bash
cd packages/types
# Option A: npm version
npm version patch   # or minor / major

# Option B: manually edit package.json version field
```

After version changes, regenerate `bun.lock`:

```bash
bun install
```

---

## 3. npm Publish

### 3.1 Manual Publish

```bash
# Remove workspace:* if it exists
grep -R "workspace:\*" packages/types/package.json

# Login to npm
npm login

# Verify the npm organization exists
npm org ls @hermit-org
```

### 3.2 Publish Steps

```bash
cd packages/types

# Preview the tarball
bun publish --dry-run

# Publish publicly
bun publish --access public

# Or use npm if bun publish is unavailable
npm publish --access public

# Verify the version is live
npm view @hermit-org/types versions
```

### 3.3 CI Publish (GitHub Actions)

Push a tag starting with `v` (e.g. `v0.1.0`) or trigger the `publish-packages.yml` workflow manually with a version number. This publishes `types`, `utils`, `stdio-to-sse`, and `cli` in order.

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## 4. Build Artifacts

### 4.1 CLI Binary

```bash
bun build ./packages/cli/src/index.ts \
  --compile \
  --outfile hermit-cli
```

Output: single executable file `hermit-cli`.

### 4.2 Web App

```bash
cd apps/web
bun run build
```

Output: static files in `apps/web/dist/`.

Deployed to GitHub Pages via `deploy-web.yml` workflow (triggered by `v*` tag or manual dispatch).

### 4.3 React Native Client

iOS Release:

```bash
cd apps/mobile
bun run ios --mode Release
```

Output:

```
ios/build/Products/Release-iphoneos/HermitMobile.app
```

Android Release:

```bash
cd apps/mobile
bun run android --mode Release
```

Output:

```
android/app/build/outputs/apk/release/app-release.apk
```

Android APK is also built via `build-android.yml` CI workflow.

---

## 5. Deployment

### 5.1 Gateway Server

#### Direct Run

```bash
bun packages/cli/src/index.ts start
```

With CLI options:

```bash
# Override agent command
bun packages/cli/src/index.ts start --command "kimi" --args "acp,--model,kimi-k2"

# Specify config file path
bun packages/cli/src/index.ts start --config ./hermit.config.json
```

#### Run as npm package

```bash
npx @hermit-org/cli start
```

#### PM2 Daemon

```bash
pm2 start "bun packages/cli/src/index.ts start" --name hermit-gateway
pm2 save
pm2 startup
```

#### Docker (minimal)

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 8787
CMD ["bun", "packages/cli/src/index.ts", "start"]
```

```bash
docker build -t hermit-gateway .
docker run -p 8787:8787 hermit-gateway
```

### 5.2 Web App

```bash
cd apps/web
bun run build      # type-check + Vite build → dist/
bun run preview    # preview the built app locally
bun run e2e        # Playwright end-to-end tests
```

### 5.3 React Native Distribution

| Stage | iOS | Android |
|-------|-----|---------|
| Internal testing | TestFlight | Firebase App Distribution |
| Production | App Store Connect | Google Play Console |

Upload paths:

- iOS: Xcode → Product → Archive → Distribute App
- Android: `android/app/build/outputs/apk/release/app-release.apk` or AAB via Play Console.

### 5.4 Configuration

The gateway reads `hermit.config.json`. Default lookup path: `~/.hermit/hermit.config.json`.

Example `hermit.config.json`:

```json
{
  "agent": {
    "command": "kimi",
    "args": ["acp"]
  },
  "gateway": {
    "port": 8787,
    "hostname": "0.0.0.0",
    "endpoint": "/",
    "heartbeatInterval": 30000,
    "cors": true,
    "timeout": 0
  },
  "authorizedTokens": []
}
```

### 5.5 Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `BASE_URL` | Web app base path for GitHub Pages deploy | `/hermit/` |

The gateway server does not use `HERMIT_BRIDGE_URL`, `HERMIT_AGENT_COMMAND`, `HERMIT_BRIDGE_PORT`, or `HERMIT_LOG_LEVEL`. Configuration is managed entirely through `hermit.config.json`.

---

## 6. CI/CD (GitHub Actions)

Three workflows are configured:

### 6.1 Build Android APK (`build-android.yml`)

- **Triggers:** push to `main` or `feat/acp-rn-sync`, pull request to `main`, manual dispatch.
- **Actions:** Sets up Bun + Node + JDK 17 + Android SDK, generates Android project, builds release APK, uploads artifact.
- **Output:** `hermit-android-release` artifact (APK).

### 6.2 Deploy Web to GitHub Pages (`deploy-web.yml`)

- **Triggers:** `v*` tag push, manual dispatch.
- **Actions:** Builds `apps/web` with Vite, uploads to Pages artifact, deploys to GitHub Pages.
- **Requires:** Pages source set to "GitHub Actions" in repo settings.

### 6.3 Publish Packages to npm (`publish-packages.yml`)

- **Triggers:** `v*` tag push, manual dispatch with version input.
- **Actions:** Resolves `workspace:*` to concrete semver, publishes `types` → `utils` → `stdio-to-sse` → `cli` to npm.
- **Requires:** `NPM_TOKEN` secret configured in repo settings.

---

## 7. Mock Agent (Local Development)

For local development without a real ACP agent, use the bundled mock agent:

```bash
bun packages/cli/src/index.ts start --command "node" --args "scripts/kimi-mock-agent.js"
```

The mock agent handles `$/agent/info` and `$/prompt` JSON-RPC methods with canned responses.

An end-to-end test script is also available:

```bash
bun run scripts/test-acp-kimi.ts
```

This connects to a running gateway at `http://localhost:8787` and performs a full ACP session lifecycle (initialize → session/new → session/prompt).

---

## 8. Compatibility Notes

### 8.1 Bun and React Native Metro

- Bun installs `node_modules` correctly for React Native, but Metro resolves through Node's module algorithm.
- If Bun fails on peer dependencies or postinstall scripts, fall back to npm:
  ```bash
  npm install
  # or
  bun install --legacy-peer-deps
  ```
- Always clear Metro cache after workspace changes:
  ```bash
  bun react-native start --reset-cache
  ```

### 8.2 Lockfile Strategy

- Only `bun.lock` is kept in the repository.
- If `package-lock.json` or `pnpm-lock.yaml` exist, delete them to avoid non-deterministic installs.

### 8.3 npm Organization

- The `@hermit-org` scope must be registered as an npm organization before the first publish.
- First publish must use `--access public` because scoped packages default to private.

---

## 9. Rollback Plan

### 9.1 npm Package Rollback

If a wrong version was published within 24 hours:

```bash
npm unpublish @hermit-org/types@0.1.2 --force
```

After 24 hours, publish a new patch version instead:

```bash
npm version patch
npm publish --access public
```

### 9.2 Code Rollback

Revert a specific commit:

```bash
git revert <commit-hash>
git push origin main
```

Or reset to a known good tag (use only in emergencies):

```bash
git reset --hard v0.1.0
```

### 9.3 Hotfix Flow

```bash
# From main
git checkout -b hotfix/sse-timeout
# Fix and commit
git push origin hotfix/sse-timeout
# Open PR, squash merge to main
git tag v0.1.1
git push origin v0.1.1
# Publish immediately via CI
```

---

## 10. Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| `workspace:*` left in published package | `bun publish` fails | Replace with concrete semver version before publish |
| npm org `@hermit-org` not created | 402 / permission error | Create org at npmjs.com or use `--access public` |
| Bun install RN deps fails | peer dependency / postinstall error | Fallback to `npm install` or `bun install --legacy-peer-deps` |
| Metro cache stale | `Unable to resolve @hermit-org/types` | `bun react-native start --reset-cache` |
| Missing `bun.lock` regeneration | Inconsistent installs after version bump | Run `bun install` after every version change |
| Published wrong version | Wrong code in production | `npm unpublish @hermit-org/<pkg>@<ver> --force` within 24h |
| Hotfix not tagged | Release branch confusion | Always tag after hotfix merge: `git tag v<ver>` |
| Unauthorized SSE connection | `401 Unauthorized` response | Include `Authorization: Bearer <token>` header; generate token with `hermit pair` |
