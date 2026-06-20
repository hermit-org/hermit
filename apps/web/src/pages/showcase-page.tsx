import * as React from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, LayoutTemplate, FileText } from "lucide-react";
import { ACPClientPage } from "./acp-client-page";
import { MainLayout, SplitLayout, SettingsLayout } from "@/components/templates";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type View = "client" | "atoms-preview" | "split" | "settings";

/**
 * Demo showcase that switches between the full ACP client page and the
 * individual templates, using mock data. This is the entry point for
 * previewing the entire component system.
 */
export function ShowcasePage(): React.JSX.Element {
  const { t } = useTranslation();
  const [view, setView] = React.useState<View>("client");

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full w-full flex-col bg-background">
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-2 py-1">
          <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("showcase.preview")}
          </span>
          <ViewTab
            icon={FileText}
            label={t("showcase.acpClient")}
            active={view === "client"}
            onClick={() => setView("client")}
          />
          <ViewTab
            icon={LayoutTemplate}
            label={t("showcase.mainLayout")}
            active={view === "atoms-preview"}
            onClick={() => setView("atoms-preview")}
          />
          <ViewTab
            icon={LayoutTemplate}
            label={t("showcase.splitLayout")}
            active={view === "split"}
            onClick={() => setView("split")}
          />
          <ViewTab
            icon={LayoutGrid}
            label={t("showcase.settings")}
            active={view === "settings"}
            onClick={() => setView("settings")}
          />
          <span className="ml-auto px-2 text-[10px] text-muted-foreground">
            {t("showcase.atomicDesign")}
          </span>
        </div>

        <div className="min-h-0 flex-1">
          {view === "client" ? <ACPClientPage /> : null}
          {view === "atoms-preview" ? <MainLayout withMockData /> : null}
          {view === "split" ? <SplitLayout orientation="horizontal" /> : null}
          {view === "settings" ? <SettingsLayout /> : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

function ViewTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn("h-7 gap-1.5 text-xs", !active && "text-muted-foreground")}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
