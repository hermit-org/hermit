import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Gateway } from "../types";

interface GatewayState {
  gateways: Gateway[];
  activeGatewayId: string | null;
  addGateway: (gateway: Omit<Gateway, "id" | "createdAt" | "updatedAt">) => Gateway;
  updateGateway: (id: string, patch: Partial<Omit<Gateway, "id" | "createdAt">>) => void;
  removeGateway: (id: string) => void;
  setActiveGateway: (id: string | null) => void;
  getActiveGateway: () => Gateway | null;
}

function generateId(): string {
  return `gw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function deriveSendUrl(sseUrl: string): string {
  try {
    const url = new URL(sseUrl);
    const path = url.pathname.replace(/\/$/, "");
    url.pathname = path ? `${path}/send` : "/send";
    return url.toString();
  } catch {
    return sseUrl.endsWith("/") ? `${sseUrl}send` : `${sseUrl}/send`;
  }
}

export const useGatewayStore = create<GatewayState>()(
  persist(
    (set, get) => ({
      gateways: [],
      activeGatewayId: null,

      addGateway(gateway) {
        const now = Date.now();
        const newGateway: Gateway = {
          ...gateway,
          id: generateId(),
          sendUrl: gateway.sendUrl || deriveSendUrl(gateway.url),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          gateways: [...state.gateways, newGateway],
          activeGatewayId: state.activeGatewayId ?? newGateway.id,
        }));
        return newGateway;
      },

      updateGateway(id, patch) {
        set((state) => ({
          gateways: state.gateways.map((gw) =>
            gw.id === id
              ? {
                  ...gw,
                  ...patch,
                  sendUrl: patch.sendUrl ?? (patch.url ? deriveSendUrl(patch.url) : gw.sendUrl),
                  updatedAt: Date.now(),
                }
              : gw,
          ),
        }));
      },

      removeGateway(id) {
        set((state) => ({
          gateways: state.gateways.filter((gw) => gw.id !== id),
          activeGatewayId: state.activeGatewayId === id ? null : state.activeGatewayId,
        }));
      },

      setActiveGateway(id) {
        set({ activeGatewayId: id });
      },

      getActiveGateway() {
        const { gateways, activeGatewayId } = get();
        return gateways.find((gw) => gw.id === activeGatewayId) ?? gateways[0] ?? null;
      },
    }),
    {
      name: "hermit-gateways",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
