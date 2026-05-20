import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// 1. API Key generation (pure logic, no DB)
// ---------------------------------------------------------------------------

import {
  generateApiKey,
  verifyApiKey,
  extractKeyPrefix,
} from "@/lib/auth/api-keys";

describe("generateApiKey", () => {
  it("produces a key with the swarm_live_ prefix", async () => {
    const result = await generateApiKey();
    expect(result.key).toMatch(/^swarm_live_/);
  });

  it("returns a keyPrefix that is the first 8 chars of the random part", async () => {
    const result = await generateApiKey();
    const randomPart = result.key.replace("swarm_live_", "");
    expect(result.keyPrefix).toBe(randomPart.slice(0, 8));
    expect(result.keyPrefix).toHaveLength(8);
  });

  it("returns a bcrypt hash that verifies against the key", async () => {
    const result = await generateApiKey();
    const matches = await verifyApiKey(result.key, result.hash);
    expect(matches).toBe(true);
  });

  it("hash does NOT verify against a different key", async () => {
    const result = await generateApiKey();
    const matches = await verifyApiKey("swarm_live_wrong_key_value", result.hash);
    expect(matches).toBe(false);
  });
});

describe("extractKeyPrefix", () => {
  it("extracts the 8-char prefix from a valid key", () => {
    const prefix = extractKeyPrefix("swarm_live_ABCDEFGH_rest_of_key");
    expect(prefix).toBe("ABCDEFGH");
  });

  it("returns null for a key without the swarm_live_ prefix", () => {
    expect(extractKeyPrefix("invalid_key")).toBeNull();
    expect(extractKeyPrefix("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. HMAC signing and verification (pure crypto, no DB)
// ---------------------------------------------------------------------------

import { signRequest, verifySignature } from "@/lib/auth/hmac";

describe("HMAC signing and verification", () => {
  const secret = "test-hmac-secret-value";
  const method = "POST";
  const path = "/api/v1/agents";
  const body = JSON.stringify({ displayName: "TestAgent" });

  it("signRequest produces a hex string", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signRequest(secret, method, path, ts, body);
    expect(sig).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("verifySignature accepts a valid signature", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signRequest(secret, method, path, ts, body);
    const result = verifySignature({
      secret,
      method,
      path,
      timestamp: ts,
      signature: sig,
      body,
    });
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("verifySignature rejects a tampered body", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signRequest(secret, method, path, ts, body);
    const result = verifySignature({
      secret,
      method,
      path,
      timestamp: ts,
      signature: sig,
      body: '{"displayName":"TAMPERED"}',
    });
    expect(result.valid).toBe(false);
  });

  it("verifySignature rejects an expired timestamp", () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 600); // 10 min ago
    const sig = signRequest(secret, method, path, oldTs, body);
    const result = verifySignature({
      secret,
      method,
      path,
      timestamp: oldTs,
      signature: sig,
      body,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("skew");
  });

  it("verifySignature rejects an invalid (non-numeric) timestamp", () => {
    const result = verifySignature({
      secret,
      method,
      path,
      timestamp: "not-a-number",
      signature: "0".repeat(64),
      body,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid timestamp");
  });
});

// ---------------------------------------------------------------------------
// 3. Validation schemas (pure logic, no DB)
// ---------------------------------------------------------------------------

import {
  RegisterAgentSchema,
  SearchAgentsSchema,
} from "@/lib/validators/agent";

describe("RegisterAgentSchema", () => {
  const validInput = {
    type: "ADVERTISER" as const,
    displayName: "My Agent",
    email: "test@example.com",
    ownerAccountId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("accepts valid minimal input", () => {
    const result = RegisterAgentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts valid input with all optional fields", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      description: "A test agent",
      websiteUrl: "https://example.com",
      contactEndpoint: "https://example.com/webhook",
      logoUrl: "https://example.com/logo.png",
      capabilities: ["search", "bid"],
      metadata: { tier: "premium" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing displayName", () => {
    const result = RegisterAgentSchema.safeParse({
      type: "ADVERTISER",
      ownerAccountId: validInput.ownerAccountId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      type: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID ownerAccountId", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      ownerAccountId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid websiteUrl", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      websiteUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts affiliate profile fields", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      type: "AFFILIATE",
      audienceSize: 50000,
      channels: ["blog", "twitter", "newsletter"],
      contentType: "review",
      relevantUrls: ["https://myblog.com", "https://twitter.com/me"],
      audienceGeo: "US",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative audienceSize", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      audienceSize: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer audienceSize", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      audienceSize: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects audienceGeo that is not 2 characters", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      audienceGeo: "USA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid relevantUrls", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      relevantUrls: ["not-a-url"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 relevantUrls", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      relevantUrls: Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 channels", () => {
    const result = RegisterAgentSchema.safeParse({
      ...validInput,
      channels: Array.from({ length: 21 }, (_, i) => `channel-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe("SearchAgentsSchema", () => {
  it("applies defaults for page and pageSize", () => {
    const result = SearchAgentsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("rejects pageSize > 100", () => {
    const result = SearchAgentsSchema.safeParse({ pageSize: 200 });
    expect(result.success).toBe(false);
  });

  it("only accepts AFFILIATE as the optional type filter", () => {
    expect(SearchAgentsSchema.safeParse({ type: "AFFILIATE" }).success).toBe(
      true
    );
    expect(SearchAgentsSchema.safeParse({ type: "ADVERTISER" }).success).toBe(
      false
    );
    expect(SearchAgentsSchema.safeParse({ type: "DUAL" }).success).toBe(false);
  });

  it("accepts ACTIVE as the only searchable status", () => {
    expect(SearchAgentsSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(
      SearchAgentsSchema.safeParse({ status: "PENDING_VERIFICATION" }).success
    ).toBe(false);
    expect(SearchAgentsSchema.safeParse({ status: "SUSPENDED" }).success).toBe(
      false
    );
    expect(SearchAgentsSchema.safeParse({ status: "DEACTIVATED" }).success).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Error classes (pure logic)
// ---------------------------------------------------------------------------

import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  AuthError,
} from "@/lib/errors";

describe("Error classes", () => {
  it("NotFoundError has correct statusCode and code", () => {
    const err = new NotFoundError("Agent", "abc-123");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toContain("abc-123");
  });

  it("ConflictError has 409 status", () => {
    const err = new ConflictError("duplicate");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("ForbiddenError has 403 status", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("AuthError has 401 status", () => {
    const err = new AuthError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });
});
