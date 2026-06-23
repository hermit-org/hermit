import type { AgentCapabilities } from "@hermit-org/acp";

/** Traffic-light support status for a single ACP feature. */
export type FeatureStatus = "supported" | "partial" | "unsupported";

/** Coarse grouping used to organise the hover panel. */
export type FeatureCategory =
  | "core"
  | "session"
  | "interaction"
  | "auth"
  | "prompt"
  | "mcp";

/** Static metadata for one ACP v1 protocol feature. */
export interface AcpFeatureDef {
  /** Stable id, also used as the i18n key suffix. */
  id: string;
  /** Method / capability name as it appears in the spec. */
  spec: string;
  required: boolean;
  category: FeatureCategory;
}

/** A feature resolved against the agent's advertised capabilities. */
export interface AcpFeatureItem extends AcpFeatureDef {
  status: FeatureStatus;
}

/**
 * Canonical ACP v1 feature catalogue.
 *
 * "Required" entries are mandated by the protocol core and are assumed
 * supported once `initialize` succeeds. Optional entries are gated by the
 * agent's advertised `AgentCapabilities`.
 */
export const ACP_V1_FEATURES: readonly AcpFeatureDef[] = [
  // — Core (required) —
  { id: "initialize", spec: "initialize", required: true, category: "core" },
  { id: "session_new", spec: "session/new", required: true, category: "core" },
  { id: "session_prompt", spec: "session/prompt", required: true, category: "core" },
  { id: "session_update", spec: "session/update (notification)", required: true, category: "core" },
  { id: "session_cancel", spec: "session/cancel (notification)", required: true, category: "core" },

  // — Session lifecycle (optional) —
  { id: "session_load", spec: "session/load", required: false, category: "session" },
  { id: "session_resume", spec: "session/resume", required: false, category: "session" },
  { id: "session_close", spec: "session/close", required: false, category: "session" },
  { id: "session_list", spec: "session/list", required: false, category: "session" },
  { id: "session_delete", spec: "session/delete", required: false, category: "session" },
  { id: "session_fork", spec: "session/fork", required: false, category: "session" },

  // — Session interaction (optional) —
  { id: "session_set_mode", spec: "session/set_mode", required: false, category: "interaction" },
  { id: "session_set_config_option", spec: "session/set_config_option", required: false, category: "interaction" },

  // — Authentication (optional) —
  { id: "authenticate", spec: "authenticate", required: false, category: "auth" },
  { id: "logout", spec: "logout", required: false, category: "auth" },

  // — Prompt capabilities (optional) —
  { id: "prompt_image", spec: "promptCapabilities.image", required: false, category: "prompt" },
  { id: "prompt_audio", spec: "promptCapabilities.audio", required: false, category: "prompt" },
  { id: "prompt_embedded_context", spec: "promptCapabilities.embeddedContext", required: false, category: "prompt" },

  // — MCP integration (optional) —
  { id: "mcp_http", spec: "mcpCapabilities.http", required: false, category: "mcp" },
  { id: "mcp_sse", spec: "mcpCapabilities.sse", required: false, category: "mcp" },
] as const;

/** Ordered category list for rendering. */
export const FEATURE_CATEGORY_ORDER: readonly FeatureCategory[] = [
  "core",
  "session",
  "interaction",
  "auth",
  "prompt",
  "mcp",
];

/**
 * Resolve every feature in the catalogue against the agent's advertised
 * capabilities.
 *
 * - Required features are `supported` once the handshake completed.
 * - Optional features map to `supported` when the agent advertises them,
 *   otherwise `partial` (the agent *may* still tolerate the call, but the
 *   capability is unadvertised — so it is treated as best-effort).
 */
export function resolveAcpFeatures(
  caps: AgentCapabilities | undefined,
  initialized: boolean,
): AcpFeatureItem[] {
  const sc = caps?.sessionCapabilities;
  const pc = caps?.promptCapabilities;
  const mc = caps?.mcpCapabilities;

  const check = (def: AcpFeatureDef): FeatureStatus => {
    if (def.required) return initialized ? "supported" : "unsupported";

    switch (def.id) {
      case "session_load":
        return caps?.loadSession === true ? "supported" : "partial";
      case "session_resume":
        return sc?.resume != null ? "supported" : "partial";
      case "session_close":
        return sc?.close != null ? "supported" : "partial";
      case "session_list":
        return sc?.list != null ? "supported" : "partial";
      case "session_delete":
        return sc?.delete != null ? "supported" : "partial";
      case "session_fork":
        return sc?.fork != null ? "supported" : "partial";
      // set_mode / set_config_option availability is only known after
      // session setup; advertise as best-effort until confirmed.
      case "session_set_mode":
      case "session_set_config_option":
        return initialized ? "partial" : "unsupported";
      case "authenticate":
        return "partial";
      case "logout":
        return caps?.auth?.logout != null ? "supported" : "partial";
      case "prompt_image":
        return pc?.image === true ? "supported" : "partial";
      case "prompt_audio":
        return pc?.audio === true ? "supported" : "partial";
      case "prompt_embedded_context":
        return pc?.embeddedContext === true ? "supported" : "partial";
      case "mcp_http":
        return mc?.http === true ? "supported" : "partial";
      case "mcp_sse":
        return mc?.sse === true ? "supported" : "partial";
      default:
        return "unsupported";
    }
  };

  return ACP_V1_FEATURES.map((def) => ({
    ...def,
    status: check(def),
  }));
}

/** Quick counts for summary headers. */
export function summarizeFeatures(
  items: readonly AcpFeatureItem[],
): { supported: number; partial: number; unsupported: number; total: number } {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      acc.total += 1;
      return acc;
    },
    { supported: 0, partial: 0, unsupported: 0, total: 0 },
  );
}
