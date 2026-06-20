import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  PlugZap,
  Pencil,
  Trash2,
  ServerCog,
  ArrowRight,
  Globe,
} from "lucide-react";
import { useGatewayStore } from "../stores/gatewayStore";
import { parseConnectionString } from "../config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/atoms";
import type { Gateway } from "../types";

export interface GatewayManagerProps {
  /** Connect to a gateway (navigate to the chat view). */
  onConnect?: (gatewayId: string) => void;
}

/**
 * Gateway management page: list, add, edit, delete, paste-import, and connect.
 * The new-UI equivalent of the legacy `ServerListScreen`.
 */
export function GatewayManager({
  onConnect,
}: GatewayManagerProps): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const activeGatewayId = useGatewayStore((s) => s.activeGatewayId);
  const addGateway = useGatewayStore((s) => s.addGateway);
  const updateGateway = useGatewayStore((s) => s.updateGateway);
  const removeGateway = useGatewayStore((s) => s.removeGateway);
  const setActiveGateway = useGatewayStore((s) => s.setActiveGateway);

  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [token, setToken] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pasteValue, setPasteValue] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);

  const resetForm = (): void => {
    setName("");
    setUrl("");
    setToken("");
    setEditingId(null);
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
    resetForm();
    setNotice(null);
  };

  const handleEdit = (g: Gateway): void => {
    setEditingId(g.id);
    setName(g.name);
    setUrl(g.url);
    setToken(g.token);
  };

  const handleDelete = (id: string): void => {
    if (!window.confirm(t("gateways.deleteConfirm"))) return;
    removeGateway(id);
    if (editingId === id) resetForm();
  };

  const handleImport = (): void => {
    const config = parseConnectionString(pasteValue);
    if (!config) {
      setNotice(t("connect.invalid"));
      return;
    }
    addGateway({
      name: config.name || t("gateways.defaultName"),
      url: config.url,
      sendUrl: config.sendUrl,
      token: config.token,
    });
    setPasteValue("");
    setNotice(t("connect.imported"));
  };

  const handleConnect = (g: Gateway): void => {
    setActiveGateway(g.id);
    onConnect?.(g.id);
  };

  return (
    <div className="flex h-full w-full items-start justify-center overflow-auto bg-background p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <ServerCog className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("gateways.title")}</h1>
        </div>

        {/* Import from connection string */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <Label>{t("gateways.importTitle")}</Label>
          <div className="flex gap-2">
            <Input
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder={t("gateways.importPlaceholder")}
              autoCapitalize="none"
            />
            <Button
              variant="secondary"
              onClick={handleImport}
              disabled={!pasteValue.trim()}
            >
              {t("connect.import")}
            </Button>
          </div>
        </div>

        {/* Add / edit form */}
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label>
              {editingId ? t("gateways.edit") : t("gateways.add")}
            </Label>
            {editingId ? (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                {t("gateways.cancel")}
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("gateways.name")}
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("gateways.url")}
              autoCapitalize="none"
            />
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("gateways.token")}
              type="password"
              autoCapitalize="none"
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            {editingId ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editingId ? t("gateways.update") : t("gateways.add")}
          </Button>
        </div>

        {notice ? (
          <p className="text-sm text-muted-foreground">{notice}</p>
        ) : null}

        {/* List */}
        <div className="space-y-2">
          {gateways.length === 0 ? (
            <EmptyState
              icon={Globe}
              title={t("gateways.noGatewaysTitle")}
              description={t("gateways.noGatewaysDescription")}
            />
          ) : (
            gateways.map((g) => {
              const active = g.id === activeGatewayId;
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {g.name}
                      </span>
                      {active ? (
                        <Badge variant="secondary">{t("gateways.active")}</Badge>
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
      </div>
    </div>
  );
}
