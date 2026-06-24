import { useCallback, useEffect, useRef, useState } from "react";
import { createAcpClient, type AcpClient } from "@hermit-org/acp";
import type { AuthMethod } from "@hermit-org/acp";
import { usePermissionStore } from "../stores";
import { createMobileTransport } from "../transport/createMobileTransport";
import type { Gateway } from "../types";

export interface UseAcpClientOptions {
  gateway: Gateway | null;
  autoConnect?: boolean;
  autoAuthenticate?: boolean;
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
  authenticate: (methodId: string) => Promise<void>;
  logout: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * React hook that manages a single ACP client for a gateway using the shared
 * `@hermit-org/acp` client and the mobile SSE transport.
 */
export function useAcpClient(options: UseAcpClientOptions): UseAcpClientResult {
  const { gateway, autoConnect = false, autoAuthenticate } = options;
  const clientRef = useRef<AcpClient | null>(null);
  const gatewayRef = useRef<Gateway | null>(gateway);
  const generationRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);
  const [canLogout, setCanLogout] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  // Keep the latest gateway reference available without re-creating callbacks.
  gatewayRef.current = gateway;

  const disconnect = useCallback(() => {
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
    const currentGateway = gatewayRef.current;
    if (!currentGateway) return;
    disconnect();
    const generation = (generationRef.current += 1);

    const transport = createMobileTransport(currentGateway);
    const permissionStore = usePermissionStore;

    const client = createAcpClient({
      transport,
      clientInfo: { name: "hermit-mobile", title: "Hermit Mobile", version: "0.0.1" },
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
      const noAuthMethods = (result.authMethods ?? []).length === 0;
      setAuthenticated(noAuthMethods);
      setConnected(true);

      if (!noAuthMethods && autoAuthenticate && result.authMethods && result.authMethods.length > 0) {
        const first = result.authMethods[0];
        try {
          await client.authenticate(first.id);
          setAuthenticated(true);
        } catch (e) {
          setAuthenticated(false);
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      }
    } catch (e) {
      if (generationRef.current !== generation) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      setState("error");
      setConnected(false);
      setAuthenticated(false);
    }
  }, [disconnect, autoAuthenticate]);

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

  useEffect(() => {
    if (autoConnect && gateway) {
      void connect();
    }
    return () => {
      disconnect();
    };
  }, [gateway?.id, autoConnect, connect, disconnect]);

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
