# Hermit Mobile Review Report

**Date:** 2026-06-24  
**Scope:** `apps/mobile` and its Android build/release pipeline  
**Goal:** Review the mobile app for security, build/release, code quality, stability, and performance issues; fix high-severity problems and document the rest.

## Verification Status

| Check | Command | Result |
|-------|---------|--------|
| Type-check | `bunx tsc --noEmit` | ✅ Pass |
| Tests | `bun test` | ✅ 79 pass / 0 fail |

## High-Severity Issues Fixed

### 1. Hardcoded MMKV encryption key (`apps/mobile/src/stores/mmkv.ts`)

**Problem:** The app shipped a hardcoded `encryptionKey: "hermit-default-key"` in source code. This defeats encryption entirely — anyone with the APK or source can decrypt user data.

**Fix:** Removed the hardcoded key. MMKV now uses its default storage. If true encryption is required later, derive a per-installation key from the Android Keystore / iOS Keychain at runtime.

### 2. Release APK was unsigned / wrong artifact path (`.github/workflows/build-android.yml`)

**Problem:** The original workflow built `assembleRelease` but expected `app-release.apk`. Without signing config the actual output is `app-release-unsigned.apk`, so the artifact upload would fail. There was also no release signing, making the APK unsuitable for distribution.

**Fix:**
- Added release signing config that reads credentials from GitHub Secrets.
- Handles both signed (`app-release.apk`) and unsigned (`app-release-unsigned.apk`) outputs.
- Renames the final APK with version name.
- Creates a GitHub Release on `v*` tags or manual trigger.

Required secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

### 3. HTTP local gateways blocked on Android 9+

**Problem:** The UI suggests local gateway URLs like `http://192.168.x.x:8787`. On Android 9+ (API 28+) cleartext HTTP is blocked by default, causing connection failures.

**Fix:** The CI manifest patch now adds `android:usesCleartextTraffic="true"` to the generated `AndroidManifest.xml`. This is appropriate for a local-gateway app but should be revisited if public HTTPS gateways become the primary use case.

### 4. Camera QR scanner had no runtime permission handling (`apps/mobile/src/screens/QrScannerScreen.tsx`)

**Problem:** The screen declared a `permissionDenied` UI state but never requested or checked `CAMERA` permission at runtime. On Android 6+ the camera component could fail silently or crash.

**Fix:** Added `PermissionsAndroid.request` on mount and on retry. The camera view is only rendered after permission is granted; otherwise the denied UI is shown.

### 5. ACP client reconnected on every gateway reference change (`apps/mobile/src/acp/hooks.ts`)

**Problem:** `useAcpClient` depended on the `gateway` object reference. Because the gateway is selected from a Zustand array, unrelated gateway updates could produce new object references, causing unnecessary disconnect/reconnect cycles and potential connection flapping.

**Fix:** Stored the gateway in a ref and made connection callbacks depend only on the gateway id. Reconnection now happens only when the selected gateway actually changes.

### 6. Flaky gateway test (`packages/cli/src/lib/gateway.test.ts`)

**Problem:** Tests used random ports (collision risk) and a stdout message could be emitted before the SSE consumer connected, causing intermittent 5-second timeouts.

**Fix:**
- Tests now request port `0` (ephemeral).
- `AcpGatewayServer.start()` reads the actual bound port from `server.address()`.
- The test agent emits the target message repeatedly so the consumer receives it even if it connects slightly after spawn.

### 7. Repository type-check failed (`tsconfig.json`)

**Problem:** Root `tsconfig.json` lacked the `@/*` path alias used by `apps/web`, so `bunx tsc --noEmit` failed across the whole monorepo.

**Fix:** Added `"@/*": ["./apps/web/src/*"]` to the root `tsconfig.json` paths.

### 8. QR scanner derived wrong `sendUrl` for URLs without trailing slash (`QrScannerScreen.tsx`)

**Problem:** `parsed.url.replace(/\/$/, "/send")` only appended `/send` when the URL already ended with `/`. For `http://example.com` it produced `http://example.com` instead of `http://example.com/send`.

**Fix:** Changed regex to `replace(/\/?$/, "/send")`.

## Medium Priority Issues Fixed

### 1. i18n coupled to Zustand persisted state (`apps/mobile/src/i18n/index.ts`)

**Problem:** `i18n/index.ts` parsed the raw `hermit-settings` Zustand blob to obtain the stored language, making it fragile to storage key or shape changes.

**Fix:** Added dedicated MMKV helpers `getStoredLanguage()` / `setStoredLanguage()`. `i18n` reads from the dedicated key at startup, and `settingsStore.ts` writes to it whenever the user changes language.

### 2. FlatList lacked rendering tuning (`apps/mobile/src/screens/AcpClientScreen.tsx`)

**Problem:** The chat `FlatList` used defaults, which can cause excessive rendering and poor keyboard interaction.

**Fix:** Added `initialNumToRender={10}`, `maxToRenderPerBatch={10}`, `windowSize={15}`, `keyboardShouldPersistTaps="handled"`, and `keyboardDismissMode="interactive"`.

### 3. Streaming Markdown re-rendered every character (`apps/mobile/src/components/StreamingText.tsx`)

**Problem:** Assistant stream updates triggered a Markdown re-render on every content change, causing jank for long replies.

**Fix:** Added `useThrottle` hook (`apps/mobile/src/hooks/useThrottle.ts`) and throttled `StreamingText` updates to 80 ms, flushing the final content when the stream pauses.

### 4. Deprecated Clipboard API (`apps/mobile/src/components/CodeBlock.tsx`)

**Problem:** `Clipboard.setString` from `react-native` is deprecated and will be removed in future RN versions.

**Fix:** Migrated to `@react-native-clipboard/clipboard` and added it to `apps/mobile/package.json`.

### 5. Dead code / unused highlighter references (`apps/mobile/src/components/CodeBlock.tsx`)

**Problem:** Commented-out imports and notes about `react-native-code-highlighter` cluttered the file.

**Fix:** Removed commented imports, the unused `useSettingsStore()` call, and related notes.

### 6. versionCode derived from git commit count (`.github/workflows/build-android.yml`)

**Problem:** Using `git rev-list --count HEAD` could exceed Android's `versionCode` limit (`2,100,000,000`) in long-lived repositories and was not tied to the version name.

**Fix:** `versionCode` is now computed from the semver version name with the formula `major * 1,000,000 + minor * 1,000 + patch`, ensuring it is stable and well within limits.

## Remaining Medium / Low Priority Issues and Recommendations

| # | Area | Issue | Severity | Recommendation | Status |
|---|------|-------|----------|----------------|--------|
| 1 | Build reproducibility | `apps/mobile/android/` and `ios/` are `.gitignore`d and regenerated in CI. | Medium | Commit the Android/iOS projects to version control after generating them locally. This makes native config, ProGuard rules, and manifest changes reviewable and reproducible. | ⏸️ Blocked by missing Java/Android SDK in this environment |
| 2 | iOS | No iOS workflow or committed project; HTTP cleartext and camera permission are unhandled for iOS. | Medium | Generate and commit the iOS project. Add `NSCameraUsageDescription` to `Info.plist` and configure App Transport Security for local HTTP if needed. | ⏸️ Blocked by missing macOS/Xcode in this environment |
| 3 | Security | Gateway bearer tokens are stored in MMKV without encryption. | Medium | For high-security deployments, encrypt tokens with a per-device key from Android Keystore / iOS Keychain, or use React Native's encrypted storage. | ⏸️ Blocked by missing native toolchain; adding `react-native-keychain` requires Android/iOS project changes |
| 4 | Build | RN CLI init step downloads the template on every CI run. | Low | Pin/commit the Android project (see #1) to eliminate this network-dependent step. | Depends on #1 |

## How to Publish a Formal Release

1. Configure the four Android signing secrets in the GitHub repository settings.
2. Optionally bump `apps/mobile/package.json` version.
3. Create and push a tag:

```bash
git tag -a v0.0.2 -m "Hermit Mobile v0.0.2"
git push origin v0.0.2
```

4. GitHub Actions will build a signed release APK and create a Release with the APK attached.

## Blockers / Skipped Items

The following items require external tooling that is not available in the current environment:

1. **Commit native Android project** — requires Java JDK and Android SDK to generate the project locally.
2. **iOS project and workflow** — requires macOS and Xcode.
3. **Encrypted gateway token storage** — requires adding a native module such as `react-native-keychain`, which in turn needs the Android/iOS projects to be present for autolinking and native configuration.

## Conclusion

All high-severity issues and all locally fixable medium-priority issues have been addressed. The repository type-checks and passes all tests. The remaining blockers are purely due to missing native toolchains; once Java/Android SDK or macOS/Xcode are available, the corresponding items can be completed quickly.
