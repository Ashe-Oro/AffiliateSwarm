import { createHmac, timingSafeEqual } from "crypto";

/**
 * HMAC helpers for Shopify integration.
 *
 * Two flavours:
 * - `verifyWebhookHmac` — HMAC-SHA256 over the raw POST body, base64-compared.
 *   Used by all incoming Shopify webhooks.
 * - `verifyInstallHmac` — HMAC-SHA256 over the OAuth callback query string
 *   (Shopify spec), hex-compared. Used by /shopify/auth/callback.
 */

export function verifyWebhookHmac(
  rawBody: string,
  headerHmac: string | null,
  apiSecret: string,
): boolean {
  if (!headerHmac) return false;
  const expected = createHmac("sha256", apiSecret).update(rawBody, "utf8").digest("base64");
  return safeEqualBase64(expected, headerHmac);
}

/**
 * Verify the HMAC Shopify includes on OAuth install/callback URLs.
 * Per Shopify spec: take all query params except `hmac` and `signature`,
 * sort lexicographically by key, join as `k=v&k=v`, HMAC-SHA256 with the
 * client secret, hex-compare against the `hmac` query param.
 */
export function verifyInstallHmac(query: Record<string, string | null>, apiSecret: string): boolean {
  const providedHmac = query.hmac;
  if (!providedHmac) return false;

  const message = Object.keys(query)
    .filter((k) => k !== "hmac" && k !== "signature" && query[k] != null)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join("&");

  const expected = createHmac("sha256", apiSecret).update(message, "utf8").digest("hex");
  return safeEqualHex(expected, providedHmac);
}

function safeEqualBase64(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "base64");
    const bBuf = Buffer.from(b, "base64");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
