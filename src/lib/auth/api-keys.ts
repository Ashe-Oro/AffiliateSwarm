import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

const API_KEY_PREFIX = "rgt_live_";
const RANDOM_LENGTH = 32;
const BCRYPT_ROUNDS = 12;

export interface GeneratedApiKey {
  /** Full API key to return to the user (only shown once) */
  key: string;
  /** First 8 chars after the prefix, used for DB lookup without exposing the full key */
  keyPrefix: string;
  /** bcrypt hash of the full key, stored in the database */
  hash: string;
}

/**
 * Generate a new API key with the `rgt_live_` prefix.
 *
 * The full key is returned exactly once. Only the prefix and hash are persisted.
 */
export async function generateApiKey(): Promise<GeneratedApiKey> {
  const randomPart = nanoid(RANDOM_LENGTH);
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = randomPart.slice(0, 8);
  const hash = await bcrypt.hash(key, BCRYPT_ROUNDS);

  return { key, keyPrefix, hash };
}

/**
 * Verify that a raw API key matches a stored bcrypt hash.
 */
export async function verifyApiKey(
  rawKey: string,
  storedHash: string
): Promise<boolean> {
  return bcrypt.compare(rawKey, storedHash);
}

/**
 * Extract the lookup prefix from a raw API key.
 * Returns `null` if the key does not start with the expected prefix.
 */
export function extractKeyPrefix(rawKey: string): string | null {
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  return rawKey.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + 8);
}
