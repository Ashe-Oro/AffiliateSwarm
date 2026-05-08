import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — registered before any module that imports them is loaded
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/auth/dashboard", () => ({
  requireAdvertiserAgent: vi.fn(),
  getDashboardUser: vi.fn(),
}));

vi.mock("@/services/campaign.service", () => ({
  createCampaign: vi.fn(),
  listCampaigns: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (loaded after mock registration)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { POST } from "../route";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import * as campaignService from "@/services/campaign.service";

const mockRequireAdvertiserAgent =
  requireAdvertiserAgent as ReturnType<typeof vi.fn>;
const mockCreateCampaign =
  campaignService.createCampaign as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Test Campaign",
  compensationModel: "CPL",
  payoutPerUnitCents: 500,
  budgetCents: 100000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/dashboard/campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdvertiserAgent.mockResolvedValue({
      agent: { id: "agent-1" },
    });
  });

  it("returns campaign data in the success envelope", async () => {
    const fakeCampaign = {
      campaign: { id: "camp-123", name: "Test Campaign" },
      escrowAccount: { id: "esc-456", campaignId: "camp-123" },
    };
    mockCreateCampaign.mockResolvedValue(fakeCampaign);

    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(201);

    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.campaign.id).toBe("camp-123");
    expect(data.data.escrowAccount.id).toBe("esc-456");

    // Client reads the id as `data.data?.campaign?.id` — verify that path works
    expect(data.data?.campaign?.id).toBe("camp-123");

    // Regression: these wrong paths caused #142
    expect(data.id).toBeUndefined();
    expect(data.campaign).toBeUndefined();
  });

  it("returns validation error for invalid input", async () => {
    const res = await POST(buildRequest({ name: "" }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
