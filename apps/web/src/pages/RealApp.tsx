/**
 * Real-data entry point for the new Atomic-Design ACP UI.
 *
 * Selects the active gateway from the persisted store (auto-creating one from
 * URL params, mirroring the legacy `App.tsx` auto-import), runs the
 * {@link useAcpPageAdapter} to bridge the legacy runtime onto the new UI's
 * prop contract, and renders `<ACPClientPage />`.
 *
 * When no gateway is configured it shows a minimal inline connect form rather
 * than reaching into the legacy `screens/`.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, PlugZap, ServerCog } from "lucide-react";

import { ACPClientPage } from "./acp-client-page";
import { useAcpPageAdapter } from "../hooks/useAcpPageAdapter";
import { useGatewayStore } from "../stores/gatewayStore";
import { readConfigFromUrl } from "../config";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EmptyState } from "../components/atoms";

export interface RealAppProps {
  /** Override the auto-selected gateway id (e.g. from routing). */
  gatewayId?: string;
}

/**
 * New UI wired to the real ACP runtime. Render this by default; fall back to
 * the legacy screens via `?legacy` (handled in `App.tsx`).
 *
 * @example
 * <RealApp />
 */
export function RealApp({ gatewayId }: RealAppProps): React.JSX.Element {
  const gateways = useGatewayStore((s) => s.gateways);
  const activeGatewayId = useGatewayStore((s) => s.activeGatewayId);
  const addGateway = useGatewayStore((s) => s.addGateway);
  const setActiveGateway = useGatewayStore((s) => s.setActiveGateway);

  // Mirror the legacy App's auto-import of a gateway from URL params so
  // `hermit start` keeps working against the new UI.
  useEffect(() => {
    const config = readConfigFromUrl();
    if (!config) return;
    const exists = gateways.some(
      (g) => g.url === config.url && g.token === config.token,
    );
    if (!exists) {
      addGateway({
        name: config.name || "Hermit Gateway",
        url: config.url,
        sendUrl: config.sendUrl,
        token: config.token,
      });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gateway = useMemo(() => {
    if (gatewayId) return gateways.find((g) => g.id === gatewayId) ?? null;
    if (activeGatewayId) {
      return gateways.find((g) => g.id === activeGatewayId) ?? null;
    }
    return gateways[0] ?? null;
  }, [gateways, activeGatewayId, gatewayId]);

  const adapter = useAcpPageAdapter(gateway);

  if (!gateway) {
    return <GatewayConnect onAdd={(id) => setActiveGateway(id)} />;
  }

  // Normalize `activeSessionId: string | null` → `string | undefined` to
  // match ACPClientPageProps without loosening the adapter's own contract.
  const { activeSessionId, ...rest } = adapter;
  return (
    <ACPClientPage
      {...rest}
      activeSessionId={activeSessionId ?? undefined}
    />
  );
}

/**
 * Minimal gateway-connection view shown when no gateway is configured. Keeps
 * the new UI self-contained without depending on the legacy `ServerListScreen`.
 */
function GatewayConnect({
  onAdd,
}: {
  onAdd: (gatewayId: string) => void;
}): React.JSX.Element {
  const addGateway = useGatewayStore((s) => s.addGateway);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  const canSave = url.trim().length > 0 && token.trim().length > 0;

  const handleSave = (): void => {
    if (!canSave) return;
    const g = addGateway({
      name: name.trim() || "Hermit Gateway",
      url: url.trim(),
      sendUrl: "",
      token: token.trim(),
    });
    setName("");
    setUrl("");
    setToken("");
    onAdd(g.id);
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <EmptyState
          icon={ServerCog}
          title="Connect to a gateway"
          description="No gateway is configured. Add a Hermit gateway URL and token to start chatting with an ACP agent."
        />
        <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="gw-name">Name</Label>
            <Input
              id="gw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hermit Gateway"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-url">SSE URL</Label>
            <Input
              id="gw-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:5174/sse"
              autoCapitalize="none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-token">Token</Label>
            <Input
              id="gw-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="pairing token"
              autoCapitalize="none"
            />
          </div>
          <Button className="w-full" disabled={!canSave} onClick={handleSave}>
            {canSave ? <PlugZap className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
}
