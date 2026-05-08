import { createHmac, createHash, timingSafeEqual } from "crypto";
import { HMAC_HEADER_NAMES } from "@/lib/brand";

/** Headers used for HMAC-signed requests. */
export const HMAC_HEADERS = HMAC_HEADER_NAMES;

/** Maximum allowed clock skew in seconds. */
const MAX_SKEW_SECONDS = 300;

/**
 * Build the canonical string that is signed.
 *
 * Format:
 *   METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + SHA256(BODY)
 */
function buildSigningString(
  method: string,
  path: string,
  timestamp: string,
  body: string
): string {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
}

/**
 * Create an HMAC-SHA256 signature for a request.
 */
export function signRequest(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string
): string {
  const signingString = buildSigningString(method, path, timestamp, body);
  return createHmac("sha256", secret).update(signingString).digest("hex");
}

export interface HmacVerifyParams {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  signature: string;
  body: string;
}

export interface HmacVerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify an HMAC-SHA256 request signature.
 *
 * Checks:
 * 1. Timestamp skew is within the allowed window (300 s).
 * 2. Recomputed signature matches the provided one (constant-time compare).
 */
export function verifySignature(params: HmacVerifyParams): HmacVerifyResult {
  const { secret, method, path, timestamp, signature, body } = params;

  // --- timestamp skew check ---
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    return { valid: false, reason: "Invalid timestamp" };
  }

  const now = Math.floor(Date.now() / 1000);
  const skew = Math.abs(now - requestTime);
  if (skew > MAX_SKEW_SECONDS) {
    return {
      valid: false,
      reason: `Timestamp skew too large (${skew}s > ${MAX_SKEW_SECONDS}s)`,
    };
  }

  // --- signature check (constant-time) ---
  const expected = signRequest(secret, method, path, timestamp, body);

  if (expected.length !== signature.length) {
    return { valid: false, reason: "Invalid signature" };
  }

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");

  if (expectedBuf.length !== actualBuf.length) {
    return { valid: false, reason: "Invalid signature" };
  }

  if (!timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}
