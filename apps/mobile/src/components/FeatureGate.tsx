import React from "react";
import { useSettingsStore } from "../stores/settingsStore";
import type { FeatureFlagKey } from "../lib/feature-flags";

const FEATURE_FLAG_SELECTORS: Record<
  FeatureFlagKey,
  (state: ReturnType<typeof useSettingsStore.getState>) => boolean
> = {
  showThoughts: (state) => state.showThoughts,
  showPlan: (state) => state.showPlan,
  showUsageStats: (state) => state.showUsageStats,
  showConfigBar: (state) => state.showConfigBar,
  showRightPanel: (state) => state.showRightPanel,
  acpExt: (state) => state.acpExt,
};

/**
 * Read a single feature flag from the settings store.
 */
export function useFeatureFlag(featureKey: FeatureFlagKey): boolean {
  return useSettingsStore(FEATURE_FLAG_SELECTORS[featureKey]);
}

/**
 * Render-prop variant for gating arbitrary JSX without a named component.
 */
export function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureFlagKey;
  children: React.ReactNode;
}): React.ReactElement | null {
  const enabled = useFeatureFlag(feature);
  if (!enabled) return null;
  return <>{children}</>;
}
