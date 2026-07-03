import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { CorsConfig } from "./cors";

/**
 * A single agent definition. Multiple agents can coexist in the config; the
 * gateway can switch between them at runtime via the `_agent/switch` extension.
 */
export interface AgentConfig {
  /** Unique identifier (e.g. "kimi", "codex"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Executable command. */
  command: string;
  /** Arguments passed to the command. */
  args: string[];
  /** Working directory for the spawned process. */
  cwd?: string;
}

/**
 * Configuration schema for `hermit.config.json`.
 */
export interface HermitConfig {
  /**
   * Single agent definition (legacy). When `agents` is absent, this field is
   * used to construct a single-agent list. Retained for backward compatibility.
   */
  agent?: {
    command: string;
    args?: string[];
    /** Working directory for the spawned agent process. */
    cwd?: string;
  };
  /**
   * Multiple agent definitions. Each entry describes an ACP agent that the
   * gateway can spawn. The `activeAgentId` determines which one starts by
   * default; clients can switch at runtime via `_agent/switch`.
   */
  agents?: AgentConfig[];
  /** The agent to activate on startup (defaults to the first entry). */
  activeAgentId?: string | null;
  /** HTTP gateway settings. */
  gateway?: {
    port?: number;
    hostname?: string;
    endpoint?: string;
    heartbeatInterval?: number;
    /**
     * Idle timeout in milliseconds. If the gateway has no active ACP prompts,
     * no `/send` input, and no stdout/stderr activity for longer than this
     * value, the agent process is stopped. The HTTP server stays running and
     * the agent is respawned on the next SSE or `/send` request. `0` disables
     * the idle timeout (default: 300000).
     */
    idleTimeout?: number;
    /**
     * CORS configuration.
     *
     * - `true`  : allow all origins (default).
     * - `false` : disable CORS.
     * - object  : fine-grained control (`{ origins, methods, headers }`).
     */
    cors?: CorsConfig;
    timeout?: number;
  };
  /** Pre-authorized bearer tokens for mobile clients. */
  authorizedTokens?: string[];
}

export const DEFAULT_CONFIG: Required<HermitConfig> = {
  agent: {
    command: "npx",
    args: ["codex", "--acp"],
    cwd: undefined,
  },
  agents: [],
  activeAgentId: null,
  gateway: {
    port: 8787,
    hostname: "0.0.0.0",
    endpoint: "/",
    heartbeatInterval: 30000,
    idleTimeout: 300000,
    cors: true,
    timeout: 0,
  },
  authorizedTokens: [],
};

const CONFIG_FILE_NAME = "hermit.config.json";

function mergeConfig(base: HermitConfig, override: HermitConfig): HermitConfig {
  return {
    agent:
      override.agent
        ? {
            command: override.agent.command ?? base.agent!.command,
            args: override.agent.args ?? base.agent!.args,
            cwd: override.agent.cwd ?? base.agent!.cwd,
          }
        : base.agent,
    agents: override.agents ?? base.agents,
    activeAgentId: override.activeAgentId ?? base.activeAgentId,
    gateway:
      override.gateway
        ? {
            port: override.gateway.port ?? base.gateway!.port,
            hostname: override.gateway.hostname ?? base.gateway!.hostname,
            endpoint: override.gateway.endpoint ?? base.gateway!.endpoint,
            heartbeatInterval:
              override.gateway.heartbeatInterval ?? base.gateway!.heartbeatInterval,
            idleTimeout: override.gateway.idleTimeout ?? base.gateway!.idleTimeout,
            cors: override.gateway.cors ?? base.gateway!.cors,
            timeout: override.gateway.timeout ?? base.gateway!.timeout,
          }
        : base.gateway,
    authorizedTokens: override.authorizedTokens ?? base.authorizedTokens,
  };
}

/**
 * Expand a leading `~` to the user's home directory.
 * Handles `~`, `~/path`, and `~user/path` (current user only).
 */
function expandTilde(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

/**
 * Load the Hermit configuration.
 *
 * When `configPath` is provided, the file at that exact path is used
 * (with `~` expanded). Otherwise the default path
 * `~/.hermit/hermit.config.json` is tried.
 * Falls back to built-in defaults when the file is absent or invalid.
 */
export async function loadConfig(
  configPath?: string,
): Promise<HermitConfig> {
  const defaultPath = join(getHermitDataDir(), CONFIG_FILE_NAME);
  const path = configPath ? expandTilde(configPath) : defaultPath;

  try {
    await access(path);
    const text = await readFile(path, "utf-8");
    const parsed = JSON.parse(text) as HermitConfig;
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

/**
 * Write the configuration back to a `hermit.config.json` file.
 *
 * When `configPath` is provided, the file is written at that exact path
 * (with `~` expanded). Otherwise the default path
 * `~/.hermit/hermit.config.json` is used, creating the directory if needed.
 */
export async function saveConfig(
  config: HermitConfig,
  configPath?: string,
): Promise<void> {
  const defaultPath = join(getHermitDataDir(), CONFIG_FILE_NAME);
  const path = configPath ? expandTilde(configPath) : defaultPath;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

/**
 * Path to the Hermit data directory inside the user's home folder.
 */
export function getHermitDataDir(): string {
  return join(homedir(), ".hermit");
}

/**
 * Ensure the Hermit data directory exists.
 */
export async function ensureHermitDataDir(): Promise<void> {
  const dir = getHermitDataDir();
  await mkdir(dir, { recursive: true });
}

/**
 * Read a JSON file from the Hermit data directory, returning `null` if absent.
 */
export async function readHermitJson<T>(name: string): Promise<T | null> {
  const path = join(getHermitDataDir(), name);
  try {
    const text = await readFile(path, "utf-8");
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write a JSON file to the Hermit data directory.
 */
export async function writeHermitJson<T>(name: string, data: T): Promise<void> {
  const path = join(getHermitDataDir(), name);
  await ensureHermitDataDir();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Runtime agent persistence
// ---------------------------------------------------------------------------

const AGENTS_FILE = "agents.json";

export interface AgentsState {
  agents: AgentConfig[];
  activeAgentId: string | null;
}

/**
 * Resolve the initial agent list from config. If `agents` is defined it takes
 * precedence; otherwise a single-element list is derived from the legacy
 * `agent` field.
 */
export function resolveAgents(config: HermitConfig): AgentsState {
  if (config.agents && config.agents.length > 0) {
    return {
      agents: config.agents,
      activeAgentId: config.activeAgentId ?? config.agents[0].id ?? null,
    };
  }
  // Derive from legacy `agent` field.
  const agent = config.agent;
  if (!agent) return { agents: [], activeAgentId: null };
  const derived: AgentConfig = {
    id: "default",
    name: "Default Agent",
    command: agent.command,
    args: agent.args ?? [],
    cwd: agent.cwd,
  };
  return { agents: [derived], activeAgentId: "default" };
}

/** Read the persisted runtime agents state (`~/.hermit/agents.json`). */
export async function readAgentsState(): Promise<AgentsState | null> {
  return readHermitJson<AgentsState>(AGENTS_FILE);
}

/** Persist the runtime agents state to `~/.hermit/agents.json`. */
export async function writeAgentsState(state: AgentsState): Promise<void> {
  await writeHermitJson(AGENTS_FILE, state);
}

/** Generate a unique agent id (used when the client does not supply one). */
export function generateAgentId(): string {
  return randomUUID().slice(0, 8);
}
