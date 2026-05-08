import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BudgetExhaustedError,
  WalletShortfallError,
} from "@/lib/errors";

const {
  mockNotify,
  mockPrisma,
  mockPlaceHold,
  mockReleaseHold,
  mockCalculatePayout,
  mockClassifyFundingError,
} = vi.hoisted(() => {
  const mockPrisma = {
    campaign: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    affiliateEnrollment: {
      findUnique: vi.fn(),
    },
    lead: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    escrowAccount: {
      findUnique: vi.fn(),
    },
    conversionEvent: {
      create: vi.fn(),
    },
    clickEvent: {
      updateMany: vi.fn(),
    },
    agent: {
      updateMany: vi.fn(),
    },
  };

  return {
    mockNotify: vi.fn(),
    mockPrisma,
    mockPlaceHold: vi.fn(),
    mockReleaseHold: vi.fn(),
    mockCalculatePayout: vi.fn(),
    mockClassifyFundingError: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/services/notification.service", () => ({
  notify: mockNotify,
}));

vi.mock("@/services/reputation.service", () => ({
  recalculateReputation: vi.fn(),
}));

vi.mock("@/services/escrow.service", () => ({
  placeHold: mockPlaceHold,
  releaseHold: mockReleaseHold,
  calculatePayout: mockCalculatePayout,
  classifyFundingError: mockClassifyFundingError,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { processPostback } from "@/services/tracking.service";

const ADVERTISER_ID = "advertiser-1";
const AFFILIATE_ID = "affiliate-1";
const CAMPAIGN_ID = "campaign-1";
const LEAD_ID = "lead-1";
const ESCROW_ID = "escrow-1";

function primePostbackHappyPathUntilHold() {
  mockPrisma.campaign.findUnique.mockResolvedValue(null);
  mockPrisma.affiliateEnrollment.findUnique.mockResolvedValue({
    campaignId: CAMPAIGN_ID,
    affiliateId: AFFILIATE_ID,
    campaign: {
      id: CAMPAIGN_ID,
      advertiserId: ADVERTISER_ID,
      name: "Mock Mugs",
      status: "ACTIVE",
      compensationModel: "CPA",
      currency: "USD",
    },
  });
  mockPrisma.lead.findFirst.mockResolvedValue(null);
  mockPrisma.escrowAccount.findUnique.mockResolvedValue({ id: ESCROW_ID });
  mockPrisma.lead.create.mockResolvedValue({
    id: LEAD_ID,
    campaignId: CAMPAIGN_ID,
    affiliateId: AFFILIATE_ID,
  });
  mockCalculatePayout.mockReturnValue(1000);
}

describe("processPostback funding failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primePostbackHappyPathUntilHold();
  });

  it("notifies conversion.funding_failed for budget-exhausted holds", async () => {
    const err = new BudgetExhaustedError({
      deficitCents: 100,
      headroomCents: 0,
      budgetCents: 1000,
    });
    mockPlaceHold.mockRejectedValueOnce(err);
    mockClassifyFundingError.mockReturnValueOnce("budget_exhausted");

    await expect(
      processPostback(ADVERTISER_ID, {
        swarm_ref: "abc",
        externalId: "ord_1",
        eventType: "PURCHASE",
      })
    ).rejects.toBe(err);

    expect(mockNotify).toHaveBeenCalledWith({
      type: "conversion.funding_failed",
      data: {
        leadId: LEAD_ID,
        campaignId: CAMPAIGN_ID,
        campaignName: "Mock Mugs",
        advertiserId: ADVERTISER_ID,
        affiliateId: AFFILIATE_ID,
        payoutCents: 1000,
        reason: "budget_exhausted",
      },
    });
    expect(mockReleaseHold).not.toHaveBeenCalled();
    expect(mockPrisma.conversionEvent.create).not.toHaveBeenCalled();
  });

  it("notifies conversion.funding_failed for wallet-shortfall holds", async () => {
    const err = new WalletShortfallError({
      deficitCents: 500,
      walletAvailableCents: 100,
    });
    mockPlaceHold.mockRejectedValueOnce(err);
    mockClassifyFundingError.mockReturnValueOnce("wallet_empty");

    await expect(
      processPostback(ADVERTISER_ID, {
        swarm_ref: "abc",
        externalId: "ord_2",
        eventType: "PURCHASE",
      })
    ).rejects.toBe(err);

    expect(mockNotify).toHaveBeenCalledWith({
      type: "conversion.funding_failed",
      data: {
        leadId: LEAD_ID,
        campaignId: CAMPAIGN_ID,
        campaignName: "Mock Mugs",
        advertiserId: ADVERTISER_ID,
        affiliateId: AFFILIATE_ID,
        payoutCents: 1000,
        reason: "wallet_empty",
      },
    });
    expect(mockReleaseHold).not.toHaveBeenCalled();
    expect(mockPrisma.conversionEvent.create).not.toHaveBeenCalled();
  });
});
