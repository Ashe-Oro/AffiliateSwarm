import { createHmac, timingSafeEqual } from "crypto";
import { shopifyEnv } from "@/lib/shopify/env";

/**
 * Shopify session-token (JWT) verification.
 *
 * App Bridge issues these to the embedded admin iframe and auto-injects
 * `Authorization: Bearer <token>` on same-origin fetches. The server must
 * verify the JWT before trusting `dest` (the shop domain).
 *
 * Format: HS256 JWT signed with the app's client secret.
 * Spec: https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 */

const VALID_SHOP_DOMAIN = /^https:\/\/[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
const ALLOWED_SKEW_S = 30;

export interface SessionTokenClaims {
  iss: string;     // <shop>/admin
  dest: string;    // https://<shop>.myshopify.com
  aud: string;     // app's client_id
  sub: string;     // user id
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

export interface VerifiedSessionToken {
  claims: SessionTokenClaims;
  shopDomain: string;
}

export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

export class SessionTokenError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

/**
 * Verify a session-token JWT and return the validated claims + shop domain.
 * Throws `SessionTokenError` if the token is malformed, signed wrong, expired,
 * or for a different app.
 */
export function verifySessionToken(token: string): VerifiedSessionToken {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new SessionTokenError("malformed_token");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; typ?: string };
  let payload: SessionTokenClaims;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionTokenClaims;
  } catch {
    throw new SessionTokenError("invalid_encoding");
  }

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new SessionTokenError("unsupported_alg");
  }

  const secret = shopifyEnv.apiSecret();
  const expected = createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest("base64url");
  if (expected.length !== signatureB64.length) {
    throw new SessionTokenError("invalid_signature");
  }
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signatureB64))) {
    throw new SessionTokenError("invalid_signature");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + ALLOWED_SKEW_S < now) {
    throw new SessionTokenError("expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf - ALLOWED_SKEW_S > now) {
    throw new SessionTokenError("not_yet_valid");
  }

  if (payload.aud !== shopifyEnv.apiKey()) {
    throw new SessionTokenError("audience_mismatch");
  }
  if (!payload.dest || !VALID_SHOP_DOMAIN.test(payload.dest)) {
    throw new SessionTokenError("invalid_dest");
  }
  if (!payload.iss || new URL(payload.iss).host !== new URL(payload.dest).host) {
    throw new SessionTokenError("iss_dest_mismatch");
  }

  const shopDomain = new URL(payload.dest).host.toLowerCase();
  return { claims: payload, shopDomain };
}

/**
 * Pull and verify a session token from a request's `Authorization: Bearer <jwt>` header.
 */
export function verifySessionTokenFromHeader(authorization: string | null): VerifiedSessionToken {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new SessionTokenError("missing_bearer");
  }
  return verifySessionToken(authorization.slice("Bearer ".length).trim());
}
