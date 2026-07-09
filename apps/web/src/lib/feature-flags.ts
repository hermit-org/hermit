/**
 * Central feature-flag registry for the web client.
 *
 * Each flag is a boolean toggle that can be controlled from settings and
 * consumed via `useFeatureFlag` / `withFeatureGate`. Adding a new pluggable
 * feature only requires adding an entry here, a setter in the settings store,
 * and (optionally) gating a component with the HOC.
 */

export type FeatureFlagKey =
  | "showThoughts"
  | "showPlan"
  | "showUsageStats"
  | "showConfigBar"
  | "showRightPanel"
  | "acpExt";

export interface FeatureFlagDef {
  /** Stable key used by the settings store and the feature-gate HOC. */
  key: FeatureFlagKey;
  /** Default value for new sessions / clean storage. */
  defaultValue: boolean;
  /** i18n key for the switch label in settings. */
  labelKey: string;
  /** i18n key for the switch hint in settings. */
  hintKey: string;
  /** If true, shows an "experimental" badge next to the feature name. */
  experimental?: boolean;
}

/**
 * Feature flags shown in the "Features" settings section.
 *
 * `acpExt` is included here so its default value has a single source of truth,
 * but its toggle is rendered in the "Agent Management" section, not here.
 */
export const FEATURE_FLAGS: FeatureFlagDef[] = [
  {
    key: "showThoughts",
    defaultValue: true,
    labelKey: "features.showThoughts",
    hintKey: "features.showThoughtsHint",
  },
  {
    key: "showPlan",
    defaultValue: true,
    labelKey: "features.showPlan",
    hintKey: "features.showPlanHint",
  },
  {
    key: "showUsageStats",
    defaultValue: true,
    labelKey: "features.showUsageStats",
    hintKey: "features.showUsageStatsHint",
  },
  {
    key: "showConfigBar",
    defaultValue: true,
    labelKey: "features.showConfigBar",
    hintKey: "features.showConfigBarHint",
  },
  {
    key: "showRightPanel",
    defaultValue: false,
    labelKey: "features.showRightPanel",
    hintKey: "features.showRightPanelHint",
  },
  {
    key: "acpExt",
    defaultValue: false,
    labelKey: "features.acpExt",
    hintKey: "features.acpExtHint",
    experimental: true,
  },
];

export const FEATURE_FLAG_DEFAULTS = FEATURE_FLAGS.reduce(
  (acc, flag) => {
    acc[flag.key] = flag.defaultValue;
    return acc;
  },
  {} as Record<FeatureFlagKey, boolean>,
);

/** O(1) lookup for flag definitions (used by settings UI). */
export const FEATURE_FLAG_BY_KEY: Record<FeatureFlagKey, FeatureFlagDef> =
  FEATURE_FLAGS.reduce(
    (acc, flag) => {
      acc[flag.key] = flag;
      return acc;
    },
    {} as Record<FeatureFlagKey, FeatureFlagDef>,
  );

/**
 * D1: `acpExt` is now included in `FEATURE_FLAGS` for a single source of truth
 * for its default value. This alias is kept for backward compatibility with
 * code that imports `ACP_EXT_FLAG` directly.
 */
export const ACP_EXT_FLAG: FeatureFlagDef = FEATURE_FLAG_BY_KEY.acpExt;
