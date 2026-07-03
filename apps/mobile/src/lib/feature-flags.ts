/**
 * Central feature-flag registry for the mobile client.
 *
 * Each flag is a boolean toggle that can be controlled from settings and
 * consumed via `useFeatureFlag` / `<FeatureGate>`. Adding a new pluggable
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
  /** Stable key used by the settings store and the feature-gate component. */
  key: FeatureFlagKey;
  /** Default value for new sessions / clean storage. */
  defaultValue: boolean;
  /** i18n key for the switch label in settings. */
  labelKey: string;
  /** i18n key for the switch hint in settings. */
  hintKey: string;
}

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
