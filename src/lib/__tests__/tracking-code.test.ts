import { describe, it, expect } from "vitest";
import { generateTrackingCode } from "@/lib/tracking-code";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

describe("generateTrackingCode", () => {
  it("returns an 8-character string", () => {
    const code = generateTrackingCode();
    expect(code).toHaveLength(8);
  });

  it("uses only Base58 characters", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateTrackingCode();
      for (const ch of code) {
        expect(BASE58_ALPHABET).toContain(ch);
      }
    }
  });

  it("produces unique codes across multiple calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateTrackingCode());
    }
    expect(codes.size).toBe(1000);
  });
});
