import { describe, it, expect, vi } from "vitest";
import { extractRevenueCents, resolveAttribution } from "../attribution";

describe("extractRevenueCents", () => {
  it("prefers current_subtotal_price over total_price", () => {
    expect(
      extractRevenueCents({
        id: 1,
        current_subtotal_price: "12.34",
        total_price: "99.99",
      }),
    ).toBe(1234);
  });
  it("falls back to subtotal_price, then total_price", () => {
    expect(extractRevenueCents({ id: 1, subtotal_price: "5.00" })).toBe(500);
    expect(extractRevenueCents({ id: 1, total_price: "1.99" })).toBe(199);
  });
  it("returns 0 for missing or malformed values", () => {
    expect(extractRevenueCents({ id: 1 })).toBe(0);
    expect(extractRevenueCents({ id: 1, total_price: "nope" })).toBe(0);
    expect(extractRevenueCents({ id: 1, total_price: "-5.00" })).toBe(0);
  });
});

describe("resolveAttribution", () => {
  const validRef = "Aa1_-bcd";

  it("returns URL_COOKIE when note_attribute swarm_ref is set without source", async () => {
    const result = await resolveAttribution({
      order: { id: 1, note_attributes: [{ name: "swarm_ref", value: validRef }] },
      advertiserApiKey: "key",
    });
    expect(result).toEqual({ path: "URL_COOKIE", swarmRef: validRef });
  });

  it("returns CHECKOUT_EXT when swarm_source=checkout_ext", async () => {
    const result = await resolveAttribution({
      order: {
        id: 1,
        note_attributes: [
          { name: "swarm_ref", value: validRef },
          { name: "swarm_source", value: "checkout_ext" },
        ],
      },
      advertiserApiKey: "key",
    });
    expect(result).toEqual({ path: "CHECKOUT_EXT", swarmRef: validRef });
  });

  it("ignores a malformed swarm_ref and falls through to discount code", async () => {
    const lookup = vi.fn().mockResolvedValue("from-code");
    const result = await resolveAttribution({
      order: {
        id: 1,
        note_attributes: [{ name: "swarm_ref", value: "!!" }],
        discount_codes: [{ code: "AFF20" }],
      },
      advertiserApiKey: "key",
      lookupDiscount: lookup,
    });
    expect(result).toEqual({ path: "DISCOUNT_CODE", swarmRef: "from-code", discountCode: "AFF20" });
    expect(lookup).toHaveBeenCalledWith({ code: "AFF20", advertiserApiKey: "key" });
  });

  it("returns NONE when no API key and only discount codes available", async () => {
    const result = await resolveAttribution({
      order: { id: 1, discount_codes: [{ code: "AFF20" }] },
      advertiserApiKey: null,
    });
    expect(result).toEqual({ path: "NONE" });
  });

  it("returns NONE when discount lookup misses for every code", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const result = await resolveAttribution({
      order: { id: 1, discount_codes: [{ code: "AAA" }, { code: "BBB" }] },
      advertiserApiKey: "key",
      lookupDiscount: lookup,
    });
    expect(result).toEqual({ path: "NONE" });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("treats discount-lookup errors as misses, doesn't abort", async () => {
    const lookup = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("found");
    const result = await resolveAttribution({
      order: { id: 1, discount_codes: [{ code: "AAA" }, { code: "BBB" }] },
      advertiserApiKey: "key",
      lookupDiscount: lookup,
    });
    expect(result).toEqual({ path: "DISCOUNT_CODE", swarmRef: "found", discountCode: "BBB" });
  });
});
