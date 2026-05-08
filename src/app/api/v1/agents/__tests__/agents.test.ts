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
    partner: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
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
    expect(json.data.apiKey).toMatch(/^rgt_live_/);
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
    // extractKeyPrefix returns null for keys without rgt_live_ prefix
    const req = buildRequest("GET", "/api/v1/agents", undefined, {
      authorization: "Bearer invalid_key_no_prefix",
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });
});
