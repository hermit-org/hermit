/**
 * Standalone gateway-registration page shown when no gateway is configured.
 *
 * Extracted from the inline `GatewayConnect` in `RealApp.tsx` so it can be
 * reused as the smart landing view (route `/`) when there are no local
 * gateways.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, PlugZap, ServerCog } from "lucide-react";

import { useGatewayStore } from "../stores/gatewayStore";
import { Button } from "../components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { EmptyState } from "@/components/atoms";

export interface GatewayRegistrationProps {
  /** Called with the newly-created gateway id after a successful add. */
  onAdded?: (gatewayId: string) => void;
}

export function GatewayRegistration({
  onAdded,
}: GatewayRegistrationProps): React.JSX.Element {
  const { t } = useTranslation();
  const addGateway = useGatewayStore((s) => s.addGateway);
  const setActiveGateway = useGatewayStore((s) => s.setActiveGateway);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  const canSave = url.trim().length > 0 && token.trim().length > 0;

  const handleSave = (): void => {
    if (!canSave) return;
    const g = addGateway({
      name: name.trim() || t("gateways.defaultName"),
      url: url.trim(),
      sendUrl: "",
      token: token.trim(),
    });
    setActiveGateway(g.id);
    setName("");
    setUrl("");
    setToken("");
    onAdded?.(g.id);
  };

  return (
    <div
      className="flex h-full w-full items-center justify-center bg-background p-6"
      data-testid="gateway-registration"
    >
      <div className="w-full max-w-md">
        <EmptyState
          icon={ServerCog}
          title={t("gateways.connectTitle")}
          description={t("gateways.connectDescription")}
        />
        <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="gw-name">{t("gateways.nameLabel")}</Label>
            <Input
              id="gw-name"
              data-testid="gateway-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("gateways.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-url">{t("gateways.sseUrlLabel")}</Label>
            <Input
              id="gw-url"
              data-testid="gateway-url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("gateways.sseUrlPlaceholder")}
              autoCapitalize="none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-token">{t("gateways.tokenLabel")}</Label>
            <Input
              id="gw-token"
              data-testid="gateway-token-input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("gateways.tokenPlaceholder")}
              autoCapitalize="none"
            />
          </div>
          <Button
            className="w-full"
            data-testid="gateway-connect-button"
            disabled={!canSave}
            onClick={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          >
            {canSave ? (
              <PlugZap className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {t("gateways.connect")}
          </Button>
        </div>
      </div>
    </div>
  );
}
