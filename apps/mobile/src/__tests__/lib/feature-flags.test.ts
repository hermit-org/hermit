import {
  FEATURE_FLAGS,
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_BY_KEY,
  type FeatureFlagKey,
} from "../../lib/feature-flags";

describe("feature-flags", () => {
  it("defines 6 flags", () => {
    expect(FEATURE_FLAGS).toHaveLength(6);
  });

  it("includes all expected keys", () => {
    const keys = FEATURE_FLAGS.map((f) => f.key);
    expect(keys).toEqual([
      "showThoughts",
      "showPlan",
      "showUsageStats",
      "showConfigBar",
      "showRightPanel",
      "acpExt",
    ]);
  });

  it("has correct default values", () => {
    expect(FEATURE_FLAG_DEFAULTS).toEqual({
      showThoughts: true,
      showPlan: true,
      showUsageStats: true,
      showConfigBar: true,
      showRightPanel: false,
      acpExt: false,
    });
  });

  it("provides O(1) lookup by key", () => {
    const keys: FeatureFlagKey[] = [
      "showThoughts",
      "showPlan",
      "showUsageStats",
      "showConfigBar",
      "showRightPanel",
      "acpExt",
    ];
    for (const key of keys) {
      expect(FEATURE_FLAG_BY_KEY[key]).toBeDefined();
      expect(FEATURE_FLAG_BY_KEY[key].key).toBe(key);
    }
  });

  it("each flag has labelKey and hintKey", () => {
    for (const flag of FEATURE_FLAGS) {
      expect(flag.labelKey).toBeTruthy();
      expect(flag.hintKey).toBeTruthy();
    }
  });
});
