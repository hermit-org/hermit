import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Palette,
  Keyboard,
  ArrowLeft,
  Languages,
  Archive,
  ServerCog,
  Plus,
  Pencil,
  Trash2,
  PlugZap,
  ArrowRight,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/atoms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSettingsStore, type AppLanguage } from "@/stores/settingsStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import { navigate, realGatewayPath } from "@/router";
import { changeAppLanguage } from "@/i18n";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_BY_KEY,
  type FeatureFlagKey,
} from "@/lib/feature-flags";
import {
  useFeatureFlag,
  useSetFeatureFlag,
} from "@/components/feature-gate";
import type { Gateway } from "@/types";

export interface SettingsLayoutProps {
  /** Initial active section. */
  defaultSection?: SettingsSection;
  /** Go back to the previous view. */
  onBack?: () => void;
  className?: string;
}

export type SettingsSection =
  | "gateways"
  | "appearance"
  | "features"
  | "shortcuts"
  | "archive"
  | "about";

const SECTIONS: { id: SettingsSection; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: "gateways", labelKey: "settings.gateways", icon: ServerCog },
    { id: "appearance", labelKey: "settings.appearance", icon: Palette },
    { id: "features", labelKey: "settings.features", icon: SlidersHorizontal },
    { id: "archive", labelKey: "settings.archive", icon: Archive },
    { id: "shortcuts", labelKey: "settings.shortcuts", icon: Keyboard },
    { id: "about", labelKey: "settings.about", icon: Info },
  ];

/**
 * Settings page layout template: a left navigation of sections and a content
 * pane that swaps between appearance and shortcuts.
 *
 * @example
 * <SettingsLayout onBack={goBack} />
 */
export function SettingsLayout({
  defaultSection = "gateways",
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
          {section === "gateways" ? (
            <GatewaySection />
          ) : section === "appearance" ? (
            <AppearanceSection />
          ) : section === "features" ? (
            <FeaturesSection />
          ) : section === "archive" ? (
            <ArchiveSection />
          ) : section === "shortcuts" ? (
            <ShortcutsSection />
          ) : (
            <AboutSection />
          )}
        </div>
      </div>
    </div>
  );
}

function GatewaySection(): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const activeGatewayId = useGatewayStore((s) => s.activeGatewayId);
  const addGateway = useGatewayStore((s) => s.addGateway);
  const updateGateway = useGatewayStore((s) => s.updateGateway);
  const removeGateway = useGatewayStore((s) => s.removeGateway);
  const setActiveGateway = useGatewayStore((s) => s.setActiveGateway);

  const [view, setView] = React.useState<"list" | "add" | "edit">("list");
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [token, setToken] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const resetForm = (): void => {
    setName("");
    setUrl("");
    setToken("");
    setEditingId(null);
    setNotice(null);
  };

  const goToList = (): void => {
    resetForm();
    setView("list");
  };

  const handleSave = (): void => {
    if (!name.trim() || !url.trim() || !token.trim()) {
      setNotice(t("gateways.requiredError"));
      return;
    }
    if (editingId) {
      updateGateway(editingId, {
        name: name.trim(),
        url: url.trim(),
        token: token.trim(),
      });
    } else {
      addGateway({
        name: name.trim(),
        url: url.trim(),
        token: token.trim(),
        sendUrl: "",
      });
    }
    goToList();
  };

  const handleAdd = (): void => {
    resetForm();
    setView("add");
  };

  const handleEdit = (g: Gateway): void => {
    setEditingId(g.id);
    setName(g.name);
    setUrl(g.url);
    setToken(g.token);
    setView("edit");
  };

  const handleDelete = (id: string): void => {
    if (!window.confirm(t("gateways.deleteConfirm"))) return;
    removeGateway(id);
    if (editingId === id) goToList();
  };

  const handleConnect = (g: Gateway): void => {
    setActiveGateway(g.id);
    navigate(realGatewayPath(g.id));
  };

  if (view === "add" || view === "edit") {
    return (
      <div className="mx-auto max-w-xl space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("common.back")}
            onClick={goToList}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">
            {view === "edit" ? t("gateways.edit") : t("gateways.add")}
          </h3>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="grid gap-2">
            <Input
              value={name}
              data-testid="settings-gateway-name-input"
              onChange={(e) => setName(e.target.value)}
              placeholder={t("gateways.name")}
            />
            <Input
              value={url}
              data-testid="settings-gateway-url-input"
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("gateways.url")}
              autoCapitalize="none"
            />
            <Input
              value={token}
              data-testid="settings-gateway-token-input"
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("gateways.token")}
              type="password"
              autoCapitalize="none"
            />
          </div>
          {notice ? (
            <p className="text-sm text-muted-foreground">{notice}</p>
          ) : null}
          <Button onClick={handleSave} className="w-full" data-testid="settings-gateway-save-button">
            {view === "edit" ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {view === "edit" ? t("gateways.update") : t("gateways.add")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t("gateways.title")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("gateways.connectDescription")}
          </p>
        </div>
        <Button type="button" size="sm" onClick={handleAdd} data-testid="settings-add-gateway-button">
          <Plus className="mr-1.5 h-4 w-4" />
          {t("gateways.add")}
        </Button>
      </div>

      {/* Gateway list */}
      <div className="space-y-2" data-testid="settings-gateway-list">
        {gateways.length === 0 ? (
          <EmptyState
            icon={ServerCog}
            title={t("gateways.noGatewaysTitle")}
            description={t("gateways.noGatewaysDescription")}
          />
        ) : (
          gateways.map((g) => {
            const active = g.id === activeGatewayId;
            return (
              <div
                key={g.id}
                data-testid="settings-gateway-item"
                data-gateway-id={g.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate text-sm font-medium"
                      data-testid="settings-gateway-item-name"
                    >
                      {g.name}
                    </span>
                    {active ? (
                      <Badge variant="secondary">
                        {t("gateways.active")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {g.url}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(g)}
                    title={t("gateways.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(g.id)}
                    title={t("gateways.delete")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleConnect(g)}
                    title={t("gateways.connect")}
                  >
                    <PlugZap className="h-4 w-4" />
                    {t("gateways.connect")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold">{t("settings.connectionTitle")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.connectionHint")}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div>
          <Label htmlFor="auto-authenticate">
            {t("settings.autoAuthenticate")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.autoAuthenticateHint")}
          </p>
        </div>
        <AutoAuthenticateSwitch />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div>
          <Label htmlFor="desktop-notifications">
            {t("settings.desktopNotifications")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.desktopNotificationsHint")}
          </p>
        </div>
        <DesktopNotificationsSwitch />
      </div>
    </div>
  );
}

function AutoAuthenticateSwitch(): React.JSX.Element {
  const autoAuthenticate = useSettingsStore((s) => s.autoAuthenticate);
  const setAutoAuthenticate = useSettingsStore(
    (s) => s.setAutoAuthenticate,
  );
  return (
    <Switch
      id="auto-authenticate"
      checked={autoAuthenticate}
      onCheckedChange={setAutoAuthenticate}
    />
  );
}

function DesktopNotificationsSwitch(): React.JSX.Element {
  const desktopNotifications = useSettingsStore((s) => s.desktopNotifications);
  const setDesktopNotifications = useSettingsStore(
    (s) => s.setDesktopNotifications,
  );
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  const supported = notificationsSupported();

  const handleChange = React.useCallback(
    async (checked: boolean) => {
      if (!checked) {
        setDesktopNotifications(false);
        return;
      }
      // Turning on: request permission first. Only persist the toggle when
      // the user actually grants it — otherwise the feature silently no-ops.
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        setDesktopNotifications(true);
      } else {
        setDesktopNotifications(false);
        force(); // re-render so the switch reflects the denied state
      }
    },
    [setDesktopNotifications],
  );

  if (!supported) return <Switch id="desktop-notifications" disabled />;
  // If the user previously granted permission, the switch stays on; if they
  // denied it in the browser settings, force the toggle off and disable it.
  const denied = notificationPermission() === "denied";
  return (
    <Switch
      id="desktop-notifications"
      checked={desktopNotifications && !denied}
      disabled={denied}
      onCheckedChange={handleChange}
    />
  );
}

function AppearanceSection(): React.JSX.Element {
  const { t } = useTranslation();
  const { language, setLanguage } = useSettingsStore();
  // Initialise dark from the live DOM / persisted preference so the switch
  // reflects the real theme (e.g. when restored by SettingsPage on mount).
  const [dark, setDark] = React.useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("hermit-theme") === "dark";
    }
    return false;
  });

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
            // Persist the preference so it survives reloads.
            try {
              if (v) localStorage.setItem("hermit-theme", "dark");
              else localStorage.setItem("hermit-theme", "light");
            } catch {
              // Ignore storage errors (disabled / quota).
            }
          }}
        />
      </div>
    </div>
  );
}

function FeatureSwitch({
  featureKey,
}: {
  featureKey: FeatureFlagKey;
}): React.JSX.Element {
  const { t } = useTranslation();
  const enabled = useFeatureFlag(featureKey);
  const setEnabled = useSetFeatureFlag(featureKey);
  const def = FEATURE_FLAG_BY_KEY[featureKey];

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <Label htmlFor={featureKey}>{t(def.labelKey)}</Label>
        <p className="text-xs text-muted-foreground">{t(def.hintKey)}</p>
      </div>
      <Switch
        id={featureKey}
        checked={enabled}
        onCheckedChange={setEnabled}
      />
    </div>
  );
}

function FeaturesSection(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h3 className="text-sm font-semibold">{t("settings.featuresTitle")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.featuresHint")}
        </p>
      </div>
      <div className="space-y-3">
        {FEATURE_FLAGS.map((flag) => (
          <FeatureSwitch key={flag.key} featureKey={flag.key} />
        ))}
      </div>
    </div>
  );
}

function ShowArchivedSwitch(): React.JSX.Element {
  const showArchivedSessions = useSettingsStore((s) => s.showArchivedSessions);
  const setShowArchivedSessions = useSettingsStore(
    (s) => s.setShowArchivedSessions,
  );
  return (
    <Switch
      id="show-archived"
      checked={showArchivedSessions}
      onCheckedChange={setShowArchivedSessions}
    />
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
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="show-archived">
            {t("settings.showArchivedSessions")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.showArchivedSessionsHint")}
          </p>
        </div>
        <ShowArchivedSwitch />
      </div>
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

function AboutSection(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h3 className="text-sm font-semibold">{t("settings.aboutTitle")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.aboutHint")}
        </p>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
        <p>{t("settings.aboutDescription")}</p>
        <p>{t("settings.aboutGatewayDescription")}</p>
        <div className="pt-2 text-xs text-muted-foreground">
          <span>{t("settings.version")}</span>
          <span className="ml-1 font-mono">0.0.1-alpha.7</span>
        </div>
      </div>
    </div>
  );
}
