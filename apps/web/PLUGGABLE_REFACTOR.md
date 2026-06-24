# Web Client Pluggable-Feature Refactor

## Overview

This refactor introduces a centralized feature-flag system for `apps/web/src`. The
goal was to reduce scattered `if/else` feature checks, make optional UI features
toggleable from Settings, and provide a reusable HOC so that gating a component
becomes a one-line wrapping operation.

## New abstractions

### 1. Feature-flag registry — `src/lib/feature-flags.ts`

A single source of truth for all pluggable features:

- `FeatureFlagKey` union type.
- `FEATURE_FLAGS` array with `key`, `defaultValue`, `labelKey`, `hintKey`.
- `FEATURE_FLAG_DEFAULTS` / `FEATURE_FLAG_BY_KEY` lookup tables.

Adding a new pluggable feature now only requires adding one entry to this file,
one boolean state + setter in `settingsStore.ts`, and (optionally) one HOC wrap.

### 2. Feature-gate HOC — `src/components/feature-gate.tsx`

- `withFeatureGate(Component, featureKey)` — higher-order component that renders
  `null` when the flag is off.
- `useFeatureFlag(featureKey)` / `useSetFeatureFlag(featureKey)` — hooks for
  custom UI or generic controls.
- `FeatureGate` — render-prop/children variant for ad-hoc gating.

Example:

```tsx
const GatedThoughtBlock = withFeatureGate(ThoughtBlock, "showThoughts");
<GatedThoughtBlock content={content} streaming={streaming} />
```

### 3. Generic settings switch — `src/components/templates/settings-layout.tsx`

- New **Features** section in the settings navigation.
- `FeatureSwitch` renders a labeled switch for any `FeatureFlagKey` by reading
  the registry, so adding a toggle is now a single `<FeatureSwitch key={...} />`
  inside `FeaturesSection`.

## Reviewed areas & coupling notes

| Area | Observation | Action |
|------|-------------|--------|
| `pages/acp-client-page.tsx` | 640+ lines; embeds `ConfigOptionBar`, `ErrorBanner`, `PlanBar` as local helpers; mixes layout orchestration with presentational bars. | Extracted `ConfigOptionBar` and `PlanBar` remain local for now, but they are now gated via HOC to reduce inline conditional rendering. The page still benefits from future extraction into `organisms/` if it keeps growing. |
| `components/organisms/chat-area.tsx` | `ThoughtBlock` was always rendered for `kind === "thought"` items; `thoughtPreviewLines` exists in settings but is unused. | Replaced with `GatedThoughtBlock`. Kept `thoughtPreviewLines` untouched (out of scope). |
| `components/organisms/status-bar.tsx` | `UsageStats` rendered only when `usage` data existed, but had no user-facing toggle. | Wrapped in `GatedUsageStats`; data-absence guard moved into a small `OptionalUsageStats` wrapper so `StatusBar` no longer concerns itself with feature flags. |
| `components/templates/settings-layout.tsx` | Each switch was a bespoke component (`AutoAuthenticateSwitch`, `RightPanelSwitch`, etc.) repeated for every setting. | Added generic `FeatureSwitch`. Existing switches left as-is to avoid unnecessary churn, but new pluggable features use the generic one. |
| Legacy root components (`ChatMessage.tsx`, `ToolCallView.tsx`, `ThoughtView.tsx`, etc.) | Not referenced by the new atomic UI but still in the tree; potential duplication/confusion. | Left untouched; deletion would be a separate cleanup task. |
| `i18n/index.ts` | Parses `localStorage.getItem("hermit-settings")` directly to read the initial language, coupling i18n to the store serialization format. | Documented only; changing it would touch persistence and is out of scope here. |
| Theme handling | Dark mode lives in `hermit-theme` localStorage key while other settings live in `hermit-settings`. | Documented only; unifying would be a settings-store refactor outside this goal. |

## Features made pluggable

| Feature | Flag key | Default | Gated component | Location |
|---------|----------|---------|-----------------|----------|
| Agent reasoning / thought blocks | `showThoughts` | `true` | `GatedThoughtBlock` | `components/organisms/chat-area.tsx` |
| Plan / todo bar | `showPlan` | `true` | `GatedPlanBar` | `pages/acp-client-page.tsx` |
| Token usage / cost stats | `showUsageStats` | `true` | `GatedUsageStats` | `components/organisms/status-bar.tsx` |
| Agent config-option bar | `showConfigBar` | `true` | `GatedConfigOptionBar` | `pages/acp-client-page.tsx` |

All flags default to `true` so existing behavior is preserved for current users.

## Features intentionally not made pluggable

| Feature | Reason |
|---------|--------|
| Right tool panel | Already controlled by `rightPanelOpen` (layout state, not a feature flag). |
| Session sidebar / archived sessions | Already controlled by `sidebarOpen` / `showArchivedSessions` (layout/state concerns). |
| Connection bar, auth banner, error banner | Critical for core functionality; hiding them would degrade the UX or break workflows. |
| Message composer / tool questions panel | Required for sending prompts and resolving permissions; disabling them would break the app. |
| Tool-call cards in chat | Part of the transcript content model; disabling them would hide agent output without a clear user benefit. |
| Image attachments / timestamps / copy buttons | Small UX details; making each toggleable would add noise without solving a clear coupling problem. |

## Files changed

- `apps/web/src/lib/feature-flags.ts` (new)
- `apps/web/src/components/feature-gate.tsx` (new)
- `apps/web/src/stores/settingsStore.ts`
- `apps/web/src/components/organisms/chat-area.tsx`
- `apps/web/src/components/organisms/status-bar.tsx`
- `apps/web/src/pages/acp-client-page.tsx`
- `apps/web/src/components/templates/settings-layout.tsx`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/zh.json`

No test files were added or modified.

## Verification

- `cd apps/web && bunx tsc --noEmit` — passes.
- `cd apps/web && bun run build` — passes.
- `bun run test` (packages + `apps/web/src`) — 96 pass, 0 fail.

## Note on root-level type-check

Running `bunx tsc --noEmit` from the repository root fails for `apps/web/src`
because the root `tsconfig.json` does not define the `@/*` path alias used by
the web app. This is a pre-existing workspace configuration issue and not
introduced by this refactor. The web app should be type-checked from
`apps/web` where its own `tsconfig.json` supplies the alias.
