import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

/**
 * Configuration schema for `hermit.config.json`.
 */
export interface HermitConfig {
  /** Command that runs the local ACP agent. */
  agent?: {
    command: string;
    args?: string[];
    /** Working directory for the spawned agent process. */
    cwd?: string;
  };
  /** HTTP gateway settings. */
  gateway?: {
    port?: number;
    hostname?: string;
    endpoint?: string;
    heartbeatInterval?: number;
    cors?: boolean;
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
  gateway: {
    port: 8787,
    hostname: "0.0.0.0",
    endpoint: "/",
    heartbeatInterval: 30000,
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
    gateway:
      override.gateway
        ? {
            port: override.gateway.port ?? base.gateway!.port,
            hostname: override.gateway.hostname ?? base.gateway!.hostname,
            endpoint: override.gateway.endpoint ?? base.gateway!.endpoint,
            heartbeatInterval:
              override.gateway.heartbeatInterval ?? base.gateway!.heartbeatInterval,
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
