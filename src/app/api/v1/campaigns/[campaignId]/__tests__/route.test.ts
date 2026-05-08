import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetAuthContext, mockGetCampaign } = vi.hoisted(() => ({
  mockGetAuthContext: vi.fn(),
  mockGetCampaign: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  withAuth: (handler: unknown) => handler,
  requireRole: () => (handler: unknown) => handler,
  requireEmailVerified: () => (handler: unknown) => handler,
  getAuthContext: mockGetAuthContext,
}));

vi.mock("@/services/campaign.service", () => ({
  getCampaign: mockGetCampaign,
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
}));

import { GET } from "../route";

function buildRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/campaigns/campaign-1");
}

function routeContext(campaignId = "campaign-1") {
  return { params: Promise.resolve({ campaignId }) };
}

function baseCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "campaign-1",
    advertiserId: "advertiser-1",
    status: "ACTIVE",
    name: "Active Campaign",
    description: "Public campaign",
    compensationModel: "CPA",
    payoutPerUnitCents: 5000,
    payoutPercentage: null,
    currency: "USD",
    landingUrl: "https://example.com",
    buyerCouponCode: "SAVE10",
    escrowAccount: { currentBalanceCents: 100_00 },
    budgetSpentCents: 0,
    dailyCapCents: 10_000,
    dailyCapCount: 100,
    leadRequirements: { email: true },
    targetingCriteria: { vertical: "saas" },
    testTrackingCode: "test-secret",
    refSeed: "seed-secret",
    advertiser: { id: "advertiser-1", displayName: "Advertiser" },
    ...overrides,
  };
}

describe("GET /api/v1/campaigns/:campaignId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthContext.mockReturnValue({
      agent: { id: "affiliate-1", type: "AFFILIATE" },
      credential: { id: "credential-1", scopes: ["*"] },
    });
  });

  it("returns public fields for non-owner access to an active campaign", async () => {
    mockGetCampaign.mockResolvedValue(baseCampaign());

    const res = await GET(buildRequest(), routeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("ACTIVE");
    expect(body.data.name).toBe("Active Campaign");
    expect(body.data.escrowAccount).toBeUndefined();
    expect(body.data.budgetSpentCents).toBeUndefined();
    expect(body.data.testTrackingCode).toBeUndefined();
    expect(body.data.refSeed).toBeUndefined();
  });

  it("hides draft campaigns from non-owners", async () => {
    mockGetCampaign.mockResolvedValue(baseCampaign({ status: "DRAFT" }));

    const res = await GET(buildRequest(), routeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("hides paused campaigns from non-owners", async () => {
    mockGetCampaign.mockResolvedValue(baseCampaign({ status: "PAUSED" }));

    const res = await GET(buildRequest(), routeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("allows owners to fetch their own draft campaign", async () => {
    mockGetAuthContext.mockReturnValue({
      agent: { id: "advertiser-1", type: "ADVERTISER" },
      credential: { id: "credential-1", scopes: ["*"] },
    });
    mockGetCampaign.mockResolvedValue(baseCampaign({ status: "DRAFT" }));

    const res = await GET(buildRequest(), routeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("DRAFT");
    expect(body.data.escrowAccount).toEqual({ currentBalanceCents: 100_00 });
  });
});
