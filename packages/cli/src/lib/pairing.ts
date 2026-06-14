import { randomBytes } from "node:crypto";
import {
  readHermitJson,
  writeHermitJson,
  loadConfig,
  saveConfig,
} from "./config";

export interface PendingPair {
  code: string;
  token: string;
  createdAt: string;
}

export interface AuthorizedTokensFile {
  tokens: string[];
}

const PENDING_PAIRS_FILE = "pending-pairs.json";
const AUTHORIZED_TOKENS_FILE = "authorized-tokens.json";

/**
 * Generate a random 6-digit pairing code.
 */
export function generatePairingCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generate a secure bearer token.
 */
export function generateToken(): string {
  return `tok_${randomBytes(24).toString("hex")}`;
}

/**
 * Create a pending pairing request and return the human-readable code.
 */
export async function createPendingPair(): Promise<{
  code: string;
  token: string;
}> {
  const code = generatePairingCode();
  const token = generateToken();
  const pending = (await readHermitJson<PendingPair[]>(PENDING_PAIRS_FILE)) ?? [];

  // Remove expired entries older than 5 minutes.
  const cutoff = Date.now() - 5 * 60 * 1000;
  const fresh = pending.filter(
    (p) => new Date(p.createdAt).getTime() > cutoff,
  );

  fresh.push({ code, token, createdAt: new Date().toISOString() });
  await writeHermitJson(PENDING_PAIRS_FILE, fresh);

  return { code, token };
}

/**
 * Validate a pairing code and return the corresponding bearer token.
 */
export async function validatePairingCode(
  code: string,
): Promise<string | null> {
  const pending = (await readHermitJson<PendingPair[]>(PENDING_PAIRS_FILE)) ?? [];
  const match = pending.find((p) => p.code === code);
  if (!match) return null;

  // Authorize the token persistently.
  await authorizeToken(match.token);

  // Remove the used code.
  const remaining = pending.filter((p) => p.code !== code);
  await writeHermitJson(PENDING_PAIRS_FILE, remaining);

  return match.token;
}

/**
 * Add a token to the authorized list.
 */
export async function authorizeToken(token: string): Promise<void> {
  const file =
    (await readHermitJson<AuthorizedTokensFile>(AUTHORIZED_TOKENS_FILE)) ?? {
      tokens: [],
    };
  if (!file.tokens.includes(token)) {
    file.tokens.push(token);
    await writeHermitJson(AUTHORIZED_TOKENS_FILE, file);
  }
}

/**
 * Check whether a bearer token is authorized.
 */
export async function isTokenAuthorized(token: string): Promise<boolean> {
  const file =
    (await readHermitJson<AuthorizedTokensFile>(AUTHORIZED_TOKENS_FILE)) ?? {
      tokens: [],
    };
  if (file.tokens.includes(token)) return true;

  // Also allow tokens configured directly in hermit.config.json.
  const config = await loadConfig();
  return config.authorizedTokens?.includes(token) ?? false;
}
