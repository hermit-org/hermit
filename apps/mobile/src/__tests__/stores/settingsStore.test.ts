import { useSettingsStore } from "../../stores/settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      showThoughts: true,
      showPlan: true,
      showUsageStats: true,
      showConfigBar: true,
      showRightPanel: false,
      acpExt: false,
      showArchivedSessions: true,
    });
  });

  describe("feature flags", () => {
    it("has correct defaults", () => {
      const state = useSettingsStore.getState();
      expect(state.showThoughts).toBe(true);
      expect(state.showPlan).toBe(true);
      expect(state.showUsageStats).toBe(true);
      expect(state.showConfigBar).toBe(true);
      expect(state.showRightPanel).toBe(false);
      expect(state.acpExt).toBe(false);
    });

    it("setShowThoughts updates state", () => {
      useSettingsStore.getState().setShowThoughts(false);
      expect(useSettingsStore.getState().showThoughts).toBe(false);
    });

    it("setAcpExt updates state", () => {
      useSettingsStore.getState().setAcpExt(true);
      expect(useSettingsStore.getState().acpExt).toBe(true);
    });

    it("setShowPlan updates state", () => {
      useSettingsStore.getState().setShowPlan(false);
      expect(useSettingsStore.getState().showPlan).toBe(false);
    });
  });

  describe("archive", () => {
    it("showArchivedSessions defaults to true", () => {
      expect(useSettingsStore.getState().showArchivedSessions).toBe(true);
    });

    it("setShowArchivedSessions updates state", () => {
      useSettingsStore.getState().setShowArchivedSessions(false);
      expect(useSettingsStore.getState().showArchivedSessions).toBe(false);
    });
  });

  describe("existing settings", () => {
    it("setTheme updates theme", () => {
      useSettingsStore.getState().setTheme("dark");
      expect(useSettingsStore.getState().theme).toBe("dark");
    });

    it("setAutoArchiveThreshold updates threshold", () => {
      useSettingsStore.getState().setAutoArchiveThreshold("7d");
      expect(useSettingsStore.getState().autoArchiveThreshold).toBe("7d");
    });

    it("setAutoAuthenticate updates value", () => {
      useSettingsStore.getState().setAutoAuthenticate(true);
      expect(useSettingsStore.getState().autoAuthenticate).toBe(true);
    });
  });
});
