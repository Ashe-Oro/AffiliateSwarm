import { describe, it, expect, beforeAll } from "vitest";
import {
  authorizeUrl,
  generateState,
  isValidShopDomain,
  verifyState,
} from "../oauth";

beforeAll(() => {
  process.env.SHOPIFY_API_KEY = "test_api_key";
  process.env.SHOPIFY_API_SECRET = "test_api_secret";
  process.env.SHOPIFY_APP_URL = "https://app.example.com";
});

describe("isValidShopDomain", () => {
  it("accepts a typical *.myshopify.com domain", () => {
    expect(isValidShopDomain("acme-store.myshopify.com")).toBe(true);
  });
  it("rejects domains with paths or schemes", () => {
    expect(isValidShopDomain("https://acme.myshopify.com")).toBe(false);
    expect(isValidShopDomain("acme.myshopify.com/path")).toBe(false);
  });
  it("rejects look-alikes", () => {
    expect(isValidShopDomain("acme.myshopify.evil.com")).toBe(false);
    expect(isValidShopDomain("acme.shopify.com")).toBe(false);
  });
});

describe("state nonce", () => {
  it("roundtrips via generate/verify", () => {
    const s = generateState();
    expect(verifyState(s)).toBe(true);
  });
  it("rejects tampered nonces", () => {
    const s = generateState();
    const [nonce, sig] = s.split(".");
    expect(verifyState(`${nonce}x.${sig}`)).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(verifyState("no-dot-here")).toBe(false);
    expect(verifyState("")).toBe(false);
  });
});

describe("authorizeUrl", () => {
  it("includes client_id, scope, redirect_uri, and state", () => {
    const u = new URL(authorizeUrl({ shop: "acme.myshopify.com", state: "abc.def" }));
    expect(u.host).toBe("acme.myshopify.com");
    expect(u.pathname).toBe("/admin/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("test_api_key");
    expect(u.searchParams.get("scope")).toBe("read_orders,write_orders");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.example.com/shopify/auth/callback");
    expect(u.searchParams.get("state")).toBe("abc.def");
  });
});
