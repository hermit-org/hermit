> **English** | [中文](./ARCHITECTURE.zh-CN.md)

# Hermit Release & Deployment Guide

## 1. Pre-release Verification (Local)

Run these checks before any publish or deploy action.

```bash
# 1.1 Install and link workspaces
bun install

# 1.2 Type-check the whole monorepo
bunx tsc --noEmit

# 1.3 Update version numbers in affected package.json files
#     For @hermit/stdio-to-sse, ensure no workspace:* dependencies remain.

# 1.4 Dry-run npm publish
bun publish --dry-run

# 1.5 Test the bridge end-to-end
bun packages/cli/src/bin/hermit.ts bridge "cat" --port 3000

# In another terminal:
curl -N http://localhost:3000/sse              # should connect
curl -X POST http://localhost:3000/message -d "ping"  # should receive "ping" via SSE
```

All checks must pass before proceeding.

---

## 2. Version Management (Independent Versions)

Hermit uses independent versioning per package.

### 2.1 Order of Version Updates

If `@hermit/cli` depends on a new version of `@hermit/stdio-to-sse`, update and publish in this order:

```
stdio-to-sse → cli → server → mobile
```

### 2.2 Bumping Versions

```bash
cd packages/stdio-to-sse
# Option A: npm version
npm version patch   # or minor / major

# Option B: manually edit package.json version field
```

After version changes, regenerate `bun.lock`:

```bash
bun install
```

---

## 3. npm Publish (`@hermit/stdio-to-sse`)

### 3.1 Prepare for Publish

```bash
# Remove workspace:* if it exists (currently none, but verify)
grep -R "workspace:\*" packages/stdio-to-sse/package.json

# Login to npm
npm login

# Verify the npm organization exists
npm org ls @hermit
```

### 3.2 Publish Steps

```bash
cd packages/stdio-to-sse

# Preview the tarball
bun publish --dry-run

# Publish publicly
bun publish --access public

# Or use npm if bun publish is unavailable
npm publish --access public

# Verify the version is live
npm view @hermit/stdio-to-sse versions
```

### 3.3 Tag the Release

```bash
git tag stdio-to-sse@0.1.2
git push origin stdio-to-sse@0.1.2
```

---

## 4. Build Artifacts

### 4.1 CLI Binary

```bash
bun build ./packages/cli/src/bin/hermit.ts \
  --compile \
  --outfile hermit-cli
```

Output: single executable file `hermit-cli`.

### 4.2 React Native Client

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

---

## 5. Deployment

### 5.1 Bridge Server

#### Direct Run

```bash
bun apps/server/src/index.ts "cat" 3000
```

#### PM2 Daemon

```bash
pm2 start "bun apps/server/src/index.ts cat 3000" --name hermit-bridge
pm2 save
pm2 startup
```

#### Docker (minimal)

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 3000
CMD ["bun", "apps/server/src/index.ts", "cat", "3000"]
```

```bash
docker build -t hermit-bridge .
docker run -p 3000:3000 hermit-bridge
```

### 5.2 React Native Distribution

| Stage | iOS | Android |
|-------|-----|---------|
| Internal testing | TestFlight | Firebase App Distribution |
| Production | App Store Connect | Google Play Console |

Upload paths:

- iOS: Xcode → Product → Archive → Distribute App
- Android: `android/app/build/outputs/apk/release/app-release.apk` or AAB via Play Console.

### 5.3 Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `HERMIT_BRIDGE_URL` | Mobile client bridge endpoint | `http://localhost:3000` |
| `HERMIT_AGENT_COMMAND` | Bridge server agent command | `cat` |
| `HERMIT_BRIDGE_PORT` | Bridge server port | `3000` |
| `HERMIT_LOG_LEVEL` | fastify log level | `info` |

---

## 6. CI/CD (Optional GitHub Actions)

### 6.1 Publish on Tag

Create `.github/workflows/publish-stdio-to-sse.yml`:

```yaml
name: Publish stdio-to-sse

on:
  push:
    tags:
      - "stdio-to-sse@*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bunx tsc --noEmit
      - run: cd packages/stdio-to-sse && bun test
      - run: cd packages/stdio-to-sse && bun publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 6.2 PR Validation

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx tsc --noEmit
      - run: cd packages/stdio-to-sse && bun test
```

---

## 7. Rollback Plan

### 7.1 npm Package Rollback

If a wrong version was published within 24 hours:

```bash
npm unpublish @hermit/stdio-to-sse@0.1.2 --force
```

After 24 hours, publish a new patch version instead:

```bash
npm version patch
npm publish --access public
```

### 7.2 Code Rollback

Revert a specific commit:

```bash
git revert <commit-hash>
git push origin main
```

Or reset to a known good tag (use only in emergencies):

```bash
git reset --hard stdio-to-sse@0.1.1
```

### 7.3 Hotfix Flow

```bash
# From main
git checkout -b hotfix/sse-timeout
# Fix and commit
git push origin hotfix/sse-timeout
# Open PR, squash merge to main
git tag stdio-to-sse@0.1.3
git push origin stdio-to-sse@0.1.3
# Publish immediately
```

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

- The `@hermit` scope must be registered as an npm organization before the first publish.
- First publish must use `--access public` because scoped packages default to private.

---

## 9. Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| `workspace:*` left in published package | `bun publish` fails | Replace with concrete semver version before publish |
| npm org `@hermit` not created | 402 / permission error | Create org at npmjs.com or use `--access public` |
| Bun install RN deps fails | peer dependency / postinstall error | Fallback to `npm install` or `bun install --legacy-peer-deps` |
| Metro cache stale | `Unable to resolve @hermit/types` | `bun react-native start --reset-cache` |
| Missing `bun.lock` regeneration | Inconsistent installs after version bump | Run `bun install` after every version change |
| Published wrong version | Wrong code in production | `npm unpublish @hermit/stdio-to-sse@<ver> --force` within 24h |
| Hotfix not tagged | Release branch confusion | Always tag after hotfix merge: `git tag <pkg>@<ver>` |
