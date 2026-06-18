import { useCallback, useEffect, useRef, useState } from "react";
import { createAcpClient, type AcpClient } from "@hermit/acp";
import { createWebTransport } from "../transport/stdio";
import type { WebSseEvent } from "../transport/connection";
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
 * Manages an `AcpClient` for a gateway. On connect it opens the web transport
 * and performs the ACP `initialize` handshake.
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

    const transport = createWebTransport({
      url: gateway.url,
      sendUrl: gateway.sendUrl,
      headers: { Authorization: `Bearer ${gateway.token}` },
      onEvent: (event: WebSseEvent) => {
        if (event.type === "state") {
          setState(event.state);
          setConnected(event.state === "connected");
        } else if (event.type === "error") {
          setError(event.error);
        }
      },
    });

    const client = createAcpClient({
      transport,
      clientInfo: { name: "hermit-web", title: "Hermit Web", version: "0.0.1" },
      clientCapabilities: {},
    });

    clientRef.current = client;
    setError(null);

    try {
      setState("connecting");
      await client.initialize();
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setState("error");
    }
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
