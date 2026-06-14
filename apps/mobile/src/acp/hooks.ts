import { useCallback, useEffect, useRef, useState } from "react";
import { createAcpClient, type AcpClient } from "./client";
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
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * React hook that manages a single ACP client for a gateway.
 */
export function useAcpClient(options: UseAcpClientOptions): UseAcpClientResult {
  const { gateway, autoConnect = false } = options;
  const clientRef = useRef<AcpClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState("disconnected");
  const [error, setError] = useState<Error | null>(null);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setConnected(false);
    setState("disconnected");
  }, []);

  const connect = useCallback(async () => {
    if (!gateway) return;
    disconnect();

    const client = createAcpClient({
      sseUrl: gateway.url,
      sendUrl: gateway.sendUrl,
      token: gateway.token,
    });

    client.onTransportEvent((event) => {
      if (event.type === "state") {
        setState(event.state);
        setConnected(event.state === "connected");
      } else if (event.type === "error") {
        setError(event.error);
      }
    });

    clientRef.current = client;
    setError(null);
    await client.connect();
  }, [gateway, disconnect]);

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
    connect,
    disconnect,
  };
}
