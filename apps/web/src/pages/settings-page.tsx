import * as React from "react";
import { SettingsLayout } from "@/components/templates/SettingsLayout";

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
  // Restore the persisted theme preference on mount, toggling the class so a
  // previously-added `dark` class is removed when the user switched to light.
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof localStorage === "undefined")
      return;
    const stored = localStorage.getItem("hermit-theme");
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  return <SettingsLayout onBack={onBack} />;
}
