import * as React from "react";
import { SettingsLayout } from "@/components/templates/settings-layout";

export interface SettingsPageProps {
  /** Navigate back to the previous view. */
  onBack?: () => void;
}

/**
 * Settings page: wires theme/shortcut preferences to the SettingsLayout.
 *
 * @example
 * <SettingsPage onBack={back} />
 */
export function SettingsPage({ onBack }: SettingsPageProps): React.JSX.Element {
  // Restore the persisted dark-mode preference on mount.
  React.useEffect(() => {
    const stored = localStorage.getItem("hermit-theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return <SettingsLayout onBack={onBack} />;
}
