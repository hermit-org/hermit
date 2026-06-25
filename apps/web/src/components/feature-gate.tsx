import * as React from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { SettingsState } from "@/stores/settingsStore";

const FEATURE_FLAG_SELECTORS: Record<
  FeatureFlagKey,
  (state: SettingsState) => boolean
> = {
  showThoughts: (state) => state.showThoughts,
  showPlan: (state) => state.showPlan,
  showUsageStats: (state) => state.showUsageStats,
  showConfigBar: (state) => state.showConfigBar,
  showRightPanel: (state) => state.showRightPanel,
};

const FEATURE_FLAG_SETTERS: Record<
  FeatureFlagKey,
  (state: SettingsState) => (value: boolean) => void
> = {
  showThoughts: (state) => state.setShowThoughts,
  showPlan: (state) => state.setShowPlan,
  showUsageStats: (state) => state.setShowUsageStats,
  showConfigBar: (state) => state.setShowConfigBar,
  showRightPanel: (state) => state.setShowRightPanel,
};

/**
 * Read a single feature flag from the settings store.
 */
export function useFeatureFlag(featureKey: FeatureFlagKey): boolean {
  return useSettingsStore(FEATURE_FLAG_SELECTORS[featureKey]);
}

/**
 * Get the setter for a single feature flag.
 */
export function useSetFeatureFlag(
  featureKey: FeatureFlagKey,
): (value: boolean) => void {
  return useSettingsStore(FEATURE_FLAG_SETTERS[featureKey]);
}

/**
 * Higher-order component that gates a component behind a feature flag.
 * When the flag is disabled the wrapped component renders `null`.
 *
 * @example
 * const GatedThoughtBlock = withFeatureGate(ThoughtBlock, "showThoughts");
 * <GatedThoughtBlock content={content} />
 */
export function withFeatureGate<P extends object>(
  Component: React.ComponentType<P>,
  featureKey: FeatureFlagKey,
): React.ComponentType<P> {
  function FeatureGatedComponent(props: P): React.ReactElement | null {
    const enabled = useFeatureFlag(featureKey);
    if (!enabled) return null;
    return <Component {...props} />;
  }

  const componentName = Component.displayName ?? Component.name ?? "Component";
  FeatureGatedComponent.displayName = `withFeatureGate(${componentName})`;

  return FeatureGatedComponent;
}

/**
 * Render-prop variant for gating arbitrary JSX without a named component.
 *
 * @example
 * <FeatureGate feature="showPlan">
 *   <PlanBar entries={plan} />
 * </FeatureGate>
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
