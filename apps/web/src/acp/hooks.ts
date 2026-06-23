import { useCallback, useEffect, useRef, useState } from "react";
import { createAcpClient, type AcpClient } from "@hermit-org/acp";
import type { AuthMethod } from "@hermit-org/acp";
import { createWebTransport } from "../transport/stdio";
import type { WebSseEvent } from "../transport/connection";
import { usePermissionStore } from "../stores";
import { useSettingsStore } from "../stores/settingsStore";
import type { Gateway } from "../types";

export interface UseAcpClientOptions {
  gateway: Gateway | null;
  autoConnect?: boolean;
}

export interface UseAcpClientResult {
  client: AcpClient | null;
  connected: boolean;
  state: string;
  error: Error | null;
  /** Auth methods advertised by the agent in `initialize`, if any. */
  authMethods: AuthMethod[];
  /** Whether the agent supports `logout`. */
  canLogout: boolean;
  /** Whether the user has authenticated locally this session. */
  authenticated: boolean;
  /** Run `authenticate` for a given advertised method id. */
  authenticate: (methodId: string) => Promise<void>;
  /** Run `logout` if the agent supports it. */
  logout: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Manages an `AcpClient` for a gateway. On connect it opens the web transport
 * and performs the ACP `initialize` handshake.
 */
export function useAcpClient(options: UseAcpClientOptions): UseAcpClientResult {
  const { gateway, autoConnect = false } = options;
  const clientRef = useRef<AcpClient | null>(null);
  // A generation id that uniquely identifies the current connection attempt.
  // Incremented on every connect/disconnect so stale async flows can detect
  // they are no longer the active connection and bail before setState.
  const generationRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);
  const [canLogout, setCanLogout] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const disconnect = useCallback(() => {
    // Invalidate any in-flight async flow from a previous connection.
    generationRef.current += 1;
    usePermissionStore.getState().clear();
    clientRef.current?.disconnect();
    clientRef.current = null;
    setConnected(false);
    setState("disconnected");
    setAuthMethods([]);
    setCanLogout(false);
    setAuthenticated(false);
  }, []);

  const connect = useCallback(async () => {
    if (!gateway) return;
    // Start a new generation; capture it so the async flow below can verify
    // it is still the active connection before touching state.
    disconnect();
    const generation = (generationRef.current += 1);

    const transport = createWebTransport({
      url: gateway.url,
      sendUrl: gateway.sendUrl,
      headers: { Authorization: `Bearer ${gateway.token}` },
      onEvent: (event: WebSseEvent) => {
        // Only apply transport state if this connection is still active.
        if (generationRef.current !== generation) return;
        if (event.type === "state") {
          setState(event.state);
          setConnected(event.state === "connected");
        } else if (event.type === "error") {
          setError(event.error);
        }
      },
    });

    const permissionStore = usePermissionStore;

    const client = createAcpClient({
      transport,
      clientInfo: { name: "hermit-web", title: "Hermit Web", version: "0.0.1" },
      // fs/terminal capabilities are intentionally NOT advertised here.
      // Hermit's agent runs locally via the CLI gateway and already has
      // direct filesystem/terminal access; advertising these client caps
      // would misdirect the agent to route fs/terminal requests through an
      // incapable browser (which can neither resolve absolute paths nor
      // spawn processes). The `@hermit-org/acp` library fully supports both —
      // native clients that CAN fulfil them should add the handlers here.
      clientCapabilities: {},
      handlers: {
        requestPermission: (params) => permissionStore.getState().request(params),
      },
    });

    clientRef.current = client;
    setError(null);

    try {
      setState("connecting");
      const result = await client.initialize();
      if (generationRef.current !== generation) return;
      setAuthMethods(result.authMethods ?? []);
      setCanLogout(result.agentCapabilities?.auth?.logout != null);
      // If the agent advertises no auth methods, treat as authenticated.
      setAuthenticated((result.authMethods ?? []).length === 0);
      setConnected(true);

      // Auto-authenticate when the setting is enabled and the agent
      // advertises at least one auth method. Uses the first method.
      const methods = result.authMethods ?? [];
      const autoAuth = useSettingsStore.getState().autoAuthenticate;
      if (autoAuth && methods.length > 0) {
        try {
          await client.authenticate(methods[0].id);
          if (generationRef.current !== generation) return;
          setAuthenticated(true);
        } catch (e) {
          if (generationRef.current !== generation) return;
          // Roll back to an unauthenticated state so the UI doesn't show a
          // misleading "connected but authenticated" hybrid.
          setError(e instanceof Error ? e : new Error(String(e)));
          setAuthenticated(false);
        }
      }
    } catch (e) {
      if (generationRef.current !== generation) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      setState("error");
      setConnected(false);
      setAuthenticated(false);
    }
  }, [gateway, disconnect]);

  const authenticate = useCallback(async (methodId: string) => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.authenticate(methodId);
      setAuthenticated(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.logout();
      setAuthenticated(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }, []);

  // Auto-connect when the gateway id changes. The connection object itself
  // is keyed by the full `gateway` via the `connect`/`disconnect` deps above;
  // here we only react to identity changes (a different gateway) to avoid
  // churn when the parent re-renders with an equivalent gateway object.
  useEffect(() => {
    if (autoConnect && gateway) {
      void connect();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway?.id, autoConnect]);

  return {
    client: clientRef.current,
    connected,
    state,
    error,
    authMethods,
    canLogout,
    authenticated,
    authenticate,
    logout,
    connect,
    disconnect,
  };
}
