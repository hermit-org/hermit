import { create } from "zustand";
import type { AcpClient } from "@hermit-org/acp";

/**
 * Shared store that exposes the RealApp's live `AcpClient` to other parts of
 * the UI (e.g. the settings page's AgentsSection) without creating a second
 * SSE connection.
 *
 * RealApp registers its client + connection state on mount; consumers read from
 * the store instead of calling `useAcpClient` themselves.
 */
interface AcpClientStoreState {
  /** The live AcpClient from RealApp, or null when no gateway is active. */
  client: AcpClient | null;
  /** Raw transport state from `useAcpClient.state` (e.g. "connecting"). */
  connectionState: string;
  /** Whether the transport (SSE) is connected. */
  transportReady: boolean;
  /** Register the RealApp client. Called by RealApp on every render/effect. */
  setClient: (client: AcpClient | null) => void;
  /** Update the transport connection state. */
  setConnectionState: (state: string) => void;
}

export const useAcpClientStore = create<AcpClientStoreState>((set) => ({
  client: null,
  connectionState: "disconnected",
  transportReady: false,
  setClient: (client) => set({ client }),
  setConnectionState: (connectionState) =>
    set({
      connectionState,
      transportReady: connectionState === "connected",
    }),
}));
