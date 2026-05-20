import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";
import { encryptSecret, decryptSecret } from "@/lib/shopify/crypto";

beforeAll(() => {
  process.env.HMAC_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("encryptSecret / decryptSecret", () => {
  it("roundtrips an arbitrary string", () => {
    const plain = "swarm_live_abcdef0123456789";
    const encoded = encryptSecret(plain);
    expect(encoded).not.toContain(plain);
    expect(decryptSecret(encoded)).toBe(plain);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plain = "hello";
    expect(encryptSecret(plain)).not.toBe(encryptSecret(plain));
  });

  it("throws on tampered ciphertext", () => {
    const encoded = encryptSecret("hello");
    const tampered = Buffer.from(encoded, "base64");
    tampered[20] ^= 0x01;
    expect(() => decryptSecret(tampered.toString("base64"))).toThrow();
  });
});
