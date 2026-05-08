import { describe, it, expect } from "vitest";
import { buildTrackingUrl } from "@/lib/tracking-url";

describe("buildTrackingUrl", () => {
  it("appends rgta_ref param to a clean URL", () => {
    const result = buildTrackingUrl("https://example.com/signup", "abc123");
    expect(result).toBe("https://example.com/signup?rgta_ref=abc123");
  });

  it("preserves existing query params", () => {
    const result = buildTrackingUrl(
      "https://example.com/signup?plan=pro",
      "abc123"
    );
    expect(result).toBe("https://example.com/signup?plan=pro&rgta_ref=abc123");
  });

  it.each([null, undefined, ""])("returns null for %s landingUrl", (input) => {
    expect(buildTrackingUrl(input, "abc123")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(buildTrackingUrl("not-a-url", "abc123")).toBeNull();
  });

  it("appends promo param when couponCode is provided", () => {
    const result = buildTrackingUrl(
      "https://example.com/signup",
      "abc123",
      "REGATTA20"
    );
    expect(result).toBe(
      "https://example.com/signup?rgta_ref=abc123&promo=REGATTA20"
    );
  });

  it.each([null, undefined, ""])(
    "does not append promo when couponCode is %s",
    (code) => {
      const result = buildTrackingUrl(
        "https://example.com/signup",
        "abc123",
        code
      );
      expect(result).toBe("https://example.com/signup?rgta_ref=abc123");
    }
  );

  it("preserves existing params when adding both rgta_ref and promo", () => {
    const result = buildTrackingUrl(
      "https://example.com/signup?plan=pro",
      "abc123",
      "SAVE10"
    );
    expect(result).toBe(
      "https://example.com/signup?plan=pro&rgta_ref=abc123&promo=SAVE10"
    );
  });
});
