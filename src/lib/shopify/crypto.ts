import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for at-rest secrets (Shopify access tokens,
 * pasted advertiser API keys). Uses the project-wide HMAC_ENCRYPTION_KEY
 * (32-byte hex). Output format: base64(iv | ciphertext | authTag).
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key(): Buffer {
  const hex = process.env.HMAC_ENCRYPTION_KEY?.trim();
  if (!hex) {
    throw new Error("HMAC_ENCRYPTION_KEY is not configured");
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("HMAC_ENCRYPTION_KEY must be a 32-byte (64 hex chars) key");
  }
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted blob too short");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
