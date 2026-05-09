/**
 * Route-level tests for verification-gated routes.
 *
 * These tests import actual route handlers so the route-level auth policy
 * stays aligned with the product behavior we intend to ship.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — declared before imports that reference them
// ---------------------------------------------------------------------------

// Track the agent that withAuth will inject into the auth context
let mockAuthAgent: Record<string, unknown> = {};

// Mock withAuth to bypass real API key verification but still run the
// handler chain (requireEmailVerified, requireRole, etc.) with a
// controlled auth context.
vi.mock("@/lib/auth/middleware", () => {
  const AUTH_CONTEXT = Symbol.for("affiliateswarm.auth");
  return {
    AUTH_CONTEXT,
    getAuthContext: (req: NextRequest) =>
      (req as unknown as Record<symbol, unknown>)[AUTH_CONTEXT],
    withAuth: (handler: (req: NextRequest, ctx?: unknown) => unknown) => {
      return async (req: NextRequest, ctx?: unknown) => {
        (req as unknown as Record<symbol, unknown>)[AUTH_CONTEXT] = {
          agent: mockAuthAgent,
          credential: { id: "cred-1", scopes: ["*"] },
        };
        return handler(req, ctx);
      };
    },
  };
});

// Mock session helper for dashboard routes
vi.mock("@/lib/auth/session", () => ({
  getSessionFromRequest: vi.fn(),
  validateSession: vi.fn(),
  SESSION_COOKIE: "affiliateswarm_session",
}));

// Mock prisma for agent lookups in dashboard auth
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findMany: vi.fn() },
  },
}));

// Mock services so handlers don't hit the real DB
vi.mock("@/services/campaign.service", () => ({
  discoverCampaigns: vi.fn().mockResolvedValue({
    campaigns: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
  }),
  applyToCampaign: vi.fn().mockResolvedValue({
    id: "enroll-1",
    status: "PENDING",
  }),
}));

import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";

const mockFindManyAgent = vi.mocked(prisma.agent.findMany);
const mockGetSession = vi.mocked(getSessionFromRequest);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(
  method: string,
  url: string,
  body?: unknown,
): NextRequest {
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "affiliate-1",
    type: "AFFILIATE",
    status: "ACTIVE",
    verificationLevel: "UNVERIFIED",
    displayName: "Test Affiliate",
    ownerAccountId: "owner-1",
    ownerUserId: "user-1",
    email: "test@example.com",
    capabilities: [],
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// V1 Route: GET /api/v1/discover/campaigns
// ---------------------------------------------------------------------------

describe("v1 route: GET /api/v1/discover/campaigns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows unverified affiliates to discover campaigns", async () => {
    mockAuthAgent = makeAgent({ verificationLevel: "UNVERIFIED" });

    const { GET } = await import("@/app/api/v1/discover/campaigns/route");

    const req = buildRequest("GET", "/api/v1/discover/campaigns");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it("allows verified affiliate through", async () => {
    mockAuthAgent = makeAgent({ verificationLevel: "EMAIL_VERIFIED" });

    const { GET } = await import("@/app/api/v1/discover/campaigns/route");

    const req = buildRequest("GET", "/api/v1/discover/campaigns");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it("allows unverified advertisers to discover campaigns", async () => {
    mockAuthAgent = makeAgent({
      type: "ADVERTISER",
      verificationLevel: "UNVERIFIED",
    });

    const { GET } = await import("@/app/api/v1/discover/campaigns/route");

    const req = buildRequest("GET", "/api/v1/discover/campaigns");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Dashboard Route: POST /api/dashboard/affiliate/apply
// ---------------------------------------------------------------------------

describe("dashboard route: POST /api/dashboard/affiliate/apply", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 EMAIL_NOT_VERIFIED for unverified affiliate", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user-1",
      user: { id: "user-1", email: "test@example.com" },
    } as never);

    mockFindManyAgent.mockResolvedValue([
      makeAgent({ verificationLevel: "UNVERIFIED" }),
    ] as never);

    const { POST } = await import(
      "@/app/api/dashboard/affiliate/apply/route"
    );

    const req = buildRequest("POST", "/api/dashboard/affiliate/apply", {
      campaignId: "00000000-0000-0000-0000-000000000001",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("allows verified affiliate through", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user-1",
      user: { id: "user-1", email: "test@example.com" },
    } as never);

    mockFindManyAgent.mockResolvedValue([
      makeAgent({ verificationLevel: "EMAIL_VERIFIED" }),
    ] as never);

    const { POST } = await import(
      "@/app/api/dashboard/affiliate/apply/route"
    );

    const req = buildRequest("POST", "/api/dashboard/affiliate/apply", {
      campaignId: "00000000-0000-0000-0000-000000000001",
    });

    const res = await POST(req);
    const body = await res.json();

    // The request may fail downstream (e.g. validation), but the key
    // assertion is that it was NOT blocked by email verification gating.
    expect(body.error?.code).not.toBe("EMAIL_NOT_VERIFIED");
    expect(res.status).not.toBe(403);
  });
});
