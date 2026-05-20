import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookHmac, verifyInstallHmac } from "../hmac";

const SECRET = "shopify_test_secret_12345";

describe("verifyWebhookHmac", () => {
  it("accepts a valid base64 HMAC over the raw body", () => {
    const body = JSON.stringify({ id: 12345, total_price: "29.99" });
    const hmac = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    expect(verifyWebhookHmac(body, hmac, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ id: 12345 });
    const hmac = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    expect(verifyWebhookHmac(body + " ", hmac, SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookHmac("anything", null, SECRET)).toBe(false);
  });

  it("rejects garbage header", () => {
    expect(verifyWebhookHmac("body", "not-base64!", SECRET)).toBe(false);
  });
});

describe("verifyInstallHmac", () => {
  it("accepts a Shopify-formatted query HMAC", () => {
    const params = {
      code: "abc",
      shop: "acme.myshopify.com",
      state: "n.s",
      timestamp: "1700000000",
    };
    const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k as keyof typeof params]}`).join("&");
    const hmac = createHmac("sha256", SECRET).update(sorted, "utf8").digest("hex");
    expect(verifyInstallHmac({ ...params, hmac }, SECRET)).toBe(true);
  });

  it("rejects a tampered query", () => {
    const params = {
      code: "abc",
      shop: "acme.myshopify.com",
      state: "n.s",
      timestamp: "1700000000",
    };
    const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k as keyof typeof params]}`).join("&");
    const hmac = createHmac("sha256", SECRET).update(sorted, "utf8").digest("hex");
    expect(verifyInstallHmac({ ...params, shop: "evil.myshopify.com", hmac }, SECRET)).toBe(false);
  });

  it("ignores hmac and signature when constructing the message", () => {
    const params = {
      code: "abc",
      shop: "acme.myshopify.com",
      state: "n.s",
      timestamp: "1700000000",
    };
    const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k as keyof typeof params]}`).join("&");
    const hmac = createHmac("sha256", SECRET).update(sorted, "utf8").digest("hex");
    expect(verifyInstallHmac({ ...params, hmac, signature: "ignored" }, SECRET)).toBe(true);
  });
});
