/**
 * Mobile wrapper around the shared `@hermit-org/acp-hooks` page adapter.
 *
 * Binds the mobile ACP client hook, MMKV storage adapter, and platform
 * confirmations before delegating to the shared logic.
 */
import {
  useAcpPageAdapter as useAcpPageAdapterBase,
  type UseAcpPageAdapterResult,
} from "@hermit-org/acp-hooks";
import { useAcpClient } from "../acp/hooks";
import { useSettingsStore } from "../stores/settingsStore";
import { mmkvAdapter } from "../stores/mmkvAdapter";
import type { Gateway } from "../types";

export function useAcpPageAdapter(
  gateway: Gateway | null,
): UseAcpPageAdapterResult {
  const autoArchiveThreshold = useSettingsStore((s) => s.autoArchiveThreshold);
  const autoAuthenticate = useSettingsStore((s) => s.autoAuthenticate);

  const acp = useAcpClient({
    gateway,
    autoConnect: true,
    autoAuthenticate,
  });

  return useAcpPageAdapterBase({
    gateway,
    acp,
    storage: mmkvAdapter,
    autoArchiveThreshold,
    // Mobile currently defaults the agent cwd to "/". If the gateway exposes
    // config in the future, replace this with a fetch/lookup.
    getAgentCwd: undefined,
  });
}
