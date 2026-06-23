import * as React from "react";
import { useTranslation } from "react-i18next";
import { Palette, Keyboard, ArrowLeft, Languages, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSettingsStore, type AppLanguage } from "@/stores/settingsStore";
import { changeAppLanguage } from "@/i18n";

export interface SettingsLayoutProps {
  /** Initial active section. */
  defaultSection?: SettingsSection;
  /** Go back to the previous view. */
  onBack?: () => void;
  className?: string;
}

export type SettingsSection = "appearance" | "shortcuts" | "archive";

const SECTIONS: { id: SettingsSection; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: "appearance", labelKey: "settings.appearance", icon: Palette },
    { id: "archive", labelKey: "settings.archive", icon: Archive },
    { id: "shortcuts", labelKey: "settings.shortcuts", icon: Keyboard },
  ];

/**
 * Settings page layout template: a left navigation of sections and a content
 * pane that swaps between appearance and shortcuts.
 *
 * @example
 * <SettingsLayout onBack={goBack} />
 */
export function SettingsLayout({
  defaultSection = "appearance",
  onBack,
  className,
}: SettingsLayoutProps): React.JSX.Element {
  const { t } = useTranslation();
  const [section, setSection] = React.useState<SettingsSection>(defaultSection);

  return (
    <div className={cn("flex h-full w-full flex-col bg-background", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("common.back")}
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <span className="text-sm font-semibold">{t("settings.title")}</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="w-48 shrink-0 border-r border-border p-2">
          {SECTIONS.map((s) => {
            const active = s.id === section;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
                {t(s.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-auto">
          {section === "appearance" ? (
            <AppearanceSection />
          ) : section === "archive" ? (
            <ArchiveSection />
          ) : (
            <ShortcutsSection />
          )}
        </div>
      </div>
    </div>
  );
}

function AppearanceSection(): React.JSX.Element {
  const { t } = useTranslation();
  const { language, setLanguage } = useSettingsStore();
  const [dark, setDark] = React.useState(false);

  const handleLanguageChange = (value: AppLanguage): void => {
    setLanguage(value);
    changeAppLanguage(value);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h3 className="text-sm font-semibold">{t("settings.language")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.languageHint")}
        </p>
      </div>
      <Select value={language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-full">
          <Languages className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t("language.en")}</SelectItem>
          <SelectItem value="zh">{t("language.zh")}</SelectItem>
        </SelectContent>
      </Select>
      <Separator />
      <div>
        <h3 className="text-sm font-semibold">{t("settings.theme")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.themeHint")}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="dark-mode">{t("settings.darkMode")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.darkModeHint")}
          </p>
        </div>
        <Switch
          id="dark-mode"
          checked={dark}
          onCheckedChange={(v) => {
            setDark(v);
            document.documentElement.classList.toggle("dark", v);
          }}
        />
      </div>
    </div>
  );
}

function ArchiveSection(): React.JSX.Element {
  const { t } = useTranslation();
  const autoArchiveThreshold = useSettingsStore((s) => s.autoArchiveThreshold);
  const setAutoArchiveThreshold = useSettingsStore(
    (s) => s.setAutoArchiveThreshold,
  );
  const enabled = autoArchiveThreshold.trim().length > 0;
  const [draft, setDraft] = React.useState(autoArchiveThreshold);
  React.useEffect(() => {
    setDraft(autoArchiveThreshold);
  }, [autoArchiveThreshold]);

  const presets = ["1h", "2h", "6h", "1d", "3d", "7d"];

  const handleToggle = (on: boolean): void => {
    if (on) {
      const value = draft.trim() || "3d";
      setAutoArchiveThreshold(value);
    } else {
      setAutoArchiveThreshold("");
    }
  };

  const commitDraft = (): void => {
    const value = draft.trim();
    setAutoArchiveThreshold(value);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h3 className="text-sm font-semibold">{t("settings.archiveTitle")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.archiveHint")}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="auto-archive">
            {t("settings.autoArchive")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.autoArchiveHint")}
          </p>
        </div>
        <Switch
          id="auto-archive"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>
      {enabled ? (
        <>
          <div>
            <Label htmlFor="archive-threshold">
              {t("settings.archiveThreshold")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("settings.archiveThresholdHint")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="archive-threshold"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              placeholder="3d"
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">
              {t("settings.archiveThresholdExample")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setDraft(p);
                  setAutoArchiveThreshold(p);
                }}
                className={cn(
                  "rounded border px-2 py-1 text-xs font-medium transition-colors",
                  autoArchiveThreshold === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-accent text-accent-foreground hover:bg-accent/70",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <Separator />
      <p className="text-xs text-muted-foreground">
        {t("settings.archiveDescription")}
      </p>
    </div>
  );
}

function ShortcutsSection(): React.JSX.Element {
  const { t } = useTranslation();
  const shortcuts = [
    { keys: "Enter", actionKey: "settings.sendMessage" },
    { keys: "Shift+Enter", actionKey: "settings.newLine" },
    { keys: "Ctrl+B", actionKey: "settings.toggleSidebar" },
    { keys: "Esc", actionKey: "settings.cancelGeneration" },
  ];
  return (
    <div className="mx-auto max-w-xl space-y-3 p-6">
      <div>
        <h3 className="text-sm font-semibold">{t("settings.keyboardShortcuts")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.shortcutsHint")}
        </p>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {shortcuts.map((s) => (
          <div
            key={s.keys}
            className="flex items-center justify-between px-3 py-2"
          >
            <span className="text-sm">{t(s.actionKey)}</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
