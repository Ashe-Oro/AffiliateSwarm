import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * API route handler tests.
 *
 * These tests exercise the POST and GET handlers from the agents route.ts
 * by constructing NextRequest objects and calling the handlers directly.
 *
 * Database calls are mocked via vi.mock so no real DB connection is needed.
 */

// ---------------------------------------------------------------------------
// Mock Prisma before any module that imports it is loaded
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      // recordEmailOutcome calls update() after every send; mock it as a noop
      // so the post-send tracking write doesn't blow up the test mocks.
      update: vi.fn().mockResolvedValue({}),
    },
    apiCredential: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    wallet: { create: vi.fn() },
    agentReputation: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/chain.service", () => ({
  deriveAdvertiserWalletAddress: vi.fn().mockResolvedValue({
    depositAddress: "0x" + "a".repeat(40),
    hdIndex: 1,
  }),
  applyAdvertiserWalletInit: vi.fn().mockImplementation(async (walletId) => ({
    id: walletId,
  })),
}));

// ---------------------------------------------------------------------------
// Imports (loaded after mock registration)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { signRequest } from "@/lib/auth/hmac";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function buildHmacHeaders(
  method: string,
  path: string,
  secret: string,
  keyId = "TESTKEY1"
): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    "X-AffiliateSwarm-Key-Id": keyId,
    "X-AffiliateSwarm-Timestamp": timestamp,
    "X-AffiliateSwarm-Signature": signRequest(
      secret,
      method,
      path,
      timestamp,
      ""
    ),
  };
}

const VALID_REGISTRATION = {
  type: "ADVERTISER",
  displayName: "TestBot",
  email: "testbot@example.com",
  ownerAccountId: "550e8400-e29b-41d4-a716-446655440000",
};

// ---------------------------------------------------------------------------
// POST /api/v1/agents
// ---------------------------------------------------------------------------

describe("POST /api/v1/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with valid registration data", async () => {
    const fakeAgent = {
      id: "agent-1",
      type: "ADVERTISER",
      displayName: "TestBot",
      ownerAccountId: VALID_REGISTRATION.ownerAccountId,
      status: "PENDING_VERIFICATION",
      verificationLevel: "NONE",
      capabilities: [],
      createdAt: new Date(),
    };
    const fakeWallet = {
      id: "wallet-1",
      currency: "USD",
      availableCents: 0,
      status: "ACTIVE",
    };

    // Mock: no duplicate found
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    // Mock $transaction to execute the callback with a tx proxy
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        // Provide the same mocked prisma as the tx argument
        (prisma.agent.create as ReturnType<typeof vi.fn>).mockResolvedValue(
          fakeAgent
        );
        (
          prisma.apiCredential.create as ReturnType<typeof vi.fn>
        ).mockResolvedValue({});
        (prisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue(
          fakeWallet
        );
        (
          prisma.agentReputation.create as ReturnType<typeof vi.fn>
        ).mockResolvedValue({});

        return fn(prisma);
      }
    );

    const req = buildRequest("POST", "/api/v1/agents", VALID_REGISTRATION);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.agent.id).toBe("agent-1");
    expect(json.data.agent.type).toBe("ADVERTISER");
    expect(json.data.apiKey).toMatch(/^swarm_live_/);
    expect(json.data.wallet.id).toBe("wallet-1");
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      VALID_REGISTRATION.email,
      expect.any(String),
      expect.any(String)
    );
    expect(json.data.verificationEmailSent).toBe(true);
    expect(json.data.verificationEmailError).toBeUndefined();
  });

  it("returns 201 with verificationEmailSent=false when the email fails to send", async () => {
    (sendVerificationEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to send verification email")
    );

    const fakeAgent = {
      id: "agent-2",
      type: "ADVERTISER",
      displayName: "TestBot",
      ownerAccountId: VALID_REGISTRATION.ownerAccountId,
      status: "PENDING_VERIFICATION",
      verificationLevel: "NONE",
      capabilities: [],
      createdAt: new Date(),
    };

    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        (prisma.agent.create as ReturnType<typeof vi.fn>).mockResolvedValue(
          fakeAgent
        );
        (prisma.apiCredential.create as ReturnType<typeof vi.fn>).mockResolvedValue(
          {}
        );
        (prisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: "wallet-2",
        });
        (prisma.agentReputation.create as ReturnType<typeof vi.fn>).mockResolvedValue(
          {}
        );
        return fn(prisma);
      }
    );

    const req = buildRequest("POST", "/api/v1/agents", VALID_REGISTRATION);
    const res = await POST(req);
    const json = await res.json();

    // Agent is still created — caller can request resend via admin endpoint.
    expect(res.status).toBe(201);
    expect(json.data.agent.id).toBe("agent-2");
    expect(json.data.verificationEmailSent).toBe(false);
    expect(json.data.verificationEmailError).toBe(
      "Failed to send verification email"
    );
  });

  it("returns 400 when required fields are missing", async () => {
    const req = buildRequest("POST", "/api/v1/agents", {
      // missing type and ownerAccountId
      displayName: "TestBot",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when type is invalid", async () => {
    const req = buildRequest("POST", "/api/v1/agents", {
      ...VALID_REGISTRATION,
      type: "INVALID_TYPE",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("returns 409 when display name already exists", async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-agent",
      displayName: "TestBot",
    });

    const req = buildRequest("POST", "/api/v1/agents", VALID_REGISTRATION);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("CONFLICT");
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/agents (requires auth)
// ---------------------------------------------------------------------------

describe("GET /api/v1/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no auth headers are provided", async () => {
    const req = buildRequest("GET", "/api/v1/agents");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("returns 401 with an invalid bearer token", async () => {
    // extractKeyPrefix returns null for keys without swarm_live_ prefix
    const req = buildRequest("GET", "/api/v1/agents", undefined, {
      authorization: "Bearer invalid_key_no_prefix",
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("returns active public profiles without internal agent fields", async () => {
    const secret = "test-hmac-secret";
    const createdAt = new Date("2026-05-01T12:00:00.000Z");

    (prisma.apiCredential.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "credential-1",
      apiKeyPrefix: "TESTKEY1",
      hmacSecret: secret,
      status: "ACTIVE",
      agent: { id: "auth-agent", status: "ACTIVE" },
    });
    (prisma.apiCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.agent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "agent-1",
        type: "AFFILIATE",
        displayName: "Recruitable Agent",
        description: "Promotes technical SaaS products.",
        websiteUrl: "https://agent.example.com",
        contactEndpoint: "https://agent.example.com/contact",
        logoUrl: "https://agent.example.com/logo.png",
        capabilities: ["content_creation", "lead_submit"],
        audienceSize: 25000,
        channels: ["blog", "newsletter"],
        contentType: "review",
        relevantUrls: ["https://agent.example.com/reviews"],
        audienceGeo: "US",
        createdAt,
        reputation: {
          trustTier: "NEW",
          overallScore: 82,
          totalLeadsSubmitted: 12,
          totalLeadsVerified: 9,
          totalConversions: 4,
        },
        email: "private@example.com",
        emailVerifyToken: "secret-token",
        status: "ACTIVE",
        metadata: { ipAllowlist: ["127.0.0.1"] },
      },
    ]);
    (prisma.agent.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const req = buildRequest(
      "GET",
      "/api/v1/agents?type=AFFILIATE&status=ACTIVE",
      undefined,
      buildHmacHeaders("GET", "/api/v1/agents", secret)
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([
      {
        id: "agent-1",
        type: "AFFILIATE",
        displayName: "Recruitable Agent",
        description: "Promotes technical SaaS products.",
        websiteUrl: "https://agent.example.com",
        contactEndpoint: "https://agent.example.com/contact",
        logoUrl: "https://agent.example.com/logo.png",
        capabilities: ["content_creation", "lead_submit"],
        affiliateProfile: {
          audienceSize: 25000,
          channels: ["blog", "newsletter"],
          contentType: "review",
          relevantUrls: ["https://agent.example.com/reviews"],
          audienceGeo: "US",
        },
        reputation: {
          trustTier: "NEW",
          overallScore: 82,
          totalLeadsSubmitted: 12,
          totalLeadsVerified: 9,
          totalConversions: 4,
        },
        createdAt: createdAt.toISOString(),
      },
    ]);

    const profile = json.data[0];
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("emailVerifyToken");
    expect(profile).not.toHaveProperty("status");
    expect(profile).not.toHaveProperty("metadata");

    const findManyArgs = (prisma.agent.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(findManyArgs.where).toEqual({
      deletedAt: null,
      status: "ACTIVE",
      type: { in: ["AFFILIATE", "DUAL"] },
    });
    expect(findManyArgs.select).not.toHaveProperty("email");
    expect(findManyArgs.select).not.toHaveProperty("emailVerifyToken");
    expect(findManyArgs.select).not.toHaveProperty("metadata");
  });

  it("rejects inactive status filters", async () => {
    const secret = "test-hmac-secret";
    (prisma.apiCredential.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "credential-1",
      apiKeyPrefix: "TESTKEY1",
      hmacSecret: secret,
      status: "ACTIVE",
      agent: { id: "auth-agent", status: "ACTIVE" },
    });
    (prisma.apiCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = buildRequest(
      "GET",
      "/api/v1/agents?status=SUSPENDED",
      undefined,
      buildHmacHeaders("GET", "/api/v1/agents", secret)
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.agent.findMany).not.toHaveBeenCalled();
  });

  it("rejects DUAL as a standalone type filter", async () => {
    const secret = "test-hmac-secret";
    (prisma.apiCredential.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "credential-1",
      apiKeyPrefix: "TESTKEY1",
      hmacSecret: secret,
      status: "ACTIVE",
      agent: { id: "auth-agent", status: "ACTIVE" },
    });
    (prisma.apiCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = buildRequest(
      "GET",
      "/api/v1/agents?type=DUAL",
      undefined,
      buildHmacHeaders("GET", "/api/v1/agents", secret)
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.agent.findMany).not.toHaveBeenCalled();
  });

  it("rejects ADVERTISER as a type filter", async () => {
    const secret = "test-hmac-secret";
    (prisma.apiCredential.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "credential-1",
      apiKeyPrefix: "TESTKEY1",
      hmacSecret: secret,
      status: "ACTIVE",
      agent: { id: "auth-agent", status: "ACTIVE" },
    });
    (prisma.apiCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = buildRequest(
      "GET",
      "/api/v1/agents?type=ADVERTISER",
      undefined,
      buildHmacHeaders("GET", "/api/v1/agents", secret)
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.agent.findMany).not.toHaveBeenCalled();
  });
});
