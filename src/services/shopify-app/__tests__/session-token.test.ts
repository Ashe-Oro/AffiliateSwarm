import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "crypto";
import {
  SessionTokenError,
  isValidShopDomain,
  verifySessionToken,
  verifySessionTokenFromHeader,
} from "../session-token";

const API_KEY = "test_api_key";
const API_SECRET = "test_api_secret_abc123";

beforeAll(() => {
  process.env.SHOPIFY_API_KEY = API_KEY;
  process.env.SHOPIFY_API_SECRET = API_SECRET;
  process.env.SHOPIFY_APP_URL = "https://app.example.com";
});

function mintToken(overrides: Partial<Record<string, unknown>> = {}, secret: string = API_SECRET): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: "https://acme.myshopify.com/admin",
    dest: "https://acme.myshopify.com",
    aud: API_KEY,
    sub: "user_1",
    exp: now + 60,
    nbf: now - 5,
    iat: now,
    jti: "j1",
    sid: "s1",
    ...overrides,
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sigB64 = createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest("base64url");
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

describe("isValidShopDomain", () => {
  it("accepts standard *.myshopify.com", () => {
    expect(isValidShopDomain("acme-shop.myshopify.com")).toBe(true);
  });
  it("rejects schemes, paths, look-alikes", () => {
    expect(isValidShopDomain("https://acme.myshopify.com")).toBe(false);
    expect(isValidShopDomain("acme.myshopify.com/x")).toBe(false);
    expect(isValidShopDomain("acme.myshopify.evil.com")).toBe(false);
  });
});

describe("verifySessionToken", () => {
  it("accepts a freshly-minted, well-formed token", () => {
    const token = mintToken();
    const result = verifySessionToken(token);
    expect(result.shopDomain).toBe("acme.myshopify.com");
    expect(result.claims.aud).toBe(API_KEY);
  });

  it("rejects a malformed token", () => {
    expect(() => verifySessionToken("not-a-jwt")).toThrow(SessionTokenError);
  });

  it("rejects a token signed with the wrong secret", () => {
    expect(() => verifySessionToken(mintToken({}, "different-secret"))).toThrow(/invalid_signature/);
  });

  it("rejects an expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(() => verifySessionToken(mintToken({ exp: now - 120 }))).toThrow(/expired/);
  });

  it("rejects a token for a different app (aud mismatch)", () => {
    expect(() => verifySessionToken(mintToken({ aud: "other_app" }))).toThrow(/audience_mismatch/);
  });

  it("rejects a token whose iss and dest disagree", () => {
    expect(() =>
      verifySessionToken(mintToken({ iss: "https://evil.myshopify.com/admin" })),
    ).toThrow(/iss_dest_mismatch/);
  });

  it("rejects a non-myshopify dest", () => {
    expect(() =>
      verifySessionToken(mintToken({ dest: "https://acme.example.com", iss: "https://acme.example.com/admin" })),
    ).toThrow(/invalid_dest/);
  });
});

describe("verifySessionTokenFromHeader", () => {
  it("strips Bearer prefix and verifies", () => {
    const token = mintToken();
    const result = verifySessionTokenFromHeader(`Bearer ${token}`);
    expect(result.shopDomain).toBe("acme.myshopify.com");
  });
  it("rejects missing or non-bearer header", () => {
    expect(() => verifySessionTokenFromHeader(null)).toThrow(/missing_bearer/);
    expect(() => verifySessionTokenFromHeader("Basic xyz")).toThrow(/missing_bearer/);
  });
});
