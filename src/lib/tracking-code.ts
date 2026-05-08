import { randomBytes, createHmac } from "crypto";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const CODE_LENGTH = 8;

function bytesToBase58Code(bytes: Buffer): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    // 256 % 58 = 24, so values 0-231 map uniformly to 0-57.
    // Values 232-255 would introduce bias. Rejection-sample them using
    // subsequent bytes (drawing from a longer input buffer keeps this
    // deterministic for HMAC-derived input).
    let b = bytes[i];
    let extra = CODE_LENGTH;
    while (b >= 232 && extra < bytes.length) {
      b = bytes[extra++];
    }
    if (b >= 232) {
      b = b % 232; // fallback — acceptable at this scale
    }
    code += BASE58_ALPHABET[b % 58];
  }
  return code;
}

/**
 * Generate a random 8-character Base58 tracking code.
 * Used for one-off codes (e.g. testTrackingCode on campaign creation).
 */
export function generateTrackingCode(): string {
  return bytesToBase58Code(randomBytes(CODE_LENGTH * 2));
}

/**
 * Generate a new 32-byte refSeed as lowercase hex (64 chars).
 */
export function generateRefSeed(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Deterministically derive a tracking code for (campaign, affiliate) pair.
 *
 * HMAC-SHA256(refSeed, affiliateId) → take 16 bytes → base58-ish encode to 8 chars.
 * Different affiliates on the same campaign produce different codes (collision
 * space is 58^8 ≈ 128 billion; per-campaign collision requires hash collision
 * which is cryptographically negligible).
 *
 * Benefit: given a campaign seed, any affiliate's code is reproducible without
 * a DB lookup — useful for audits, debugging, and rotation scenarios.
 */
export function deriveTrackingCode(refSeed: string, affiliateId: string): string {
  const seedBytes = Buffer.from(refSeed, "hex");
  const hmac = createHmac("sha256", seedBytes).update(affiliateId).digest();
  return bytesToBase58Code(hmac);
}

const MAX_RETRIES = 3;

/**
 * Run `fn` up to {@link MAX_RETRIES} times, retrying only on Prisma
 * unique-constraint violations (error code P2002).
 */
export async function withUniqueCodeRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (!isUniqueViolation || attempt === MAX_RETRIES - 1) throw err;
    }
  }
  throw new Error("unreachable");
}
