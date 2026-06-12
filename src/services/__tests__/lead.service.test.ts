import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock external modules before importing anything that uses them
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateEnrollment: {
      findUnique: vi.fn(),
    },
    campaign: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    lead: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    escrowAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    escrowHold: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    domainEvent: {
      create: vi.fn(),
    },
    fraudInvestigation: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/escrow.service", () => ({
  placeHold: vi.fn(),
  releaseHold: vi.fn(),
  refundHold: vi.fn(),
}));

vi.mock("@/services/reputation.service", () => ({
  recalculateReputation: vi.fn(),
}));

vi.mock("@/services/webhook.service", () => ({
  deliverEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (loaded after mocks)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import * as escrowService from "@/services/escrow.service";
import * as reputationService from "@/services/reputation.service";
import { deliverEvent } from "@/services/webhook.service";
import {
  submitLead,
  verifyLead,
  rejectLead,
  disputeLead,
} from "@/services/lead.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AFFILIATE_ID = "550e8400-e29b-41d4-a716-446655440001";
const ADVERTISER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CAMPAIGN_ID = "660e8400-e29b-41d4-a716-446655440000";
const LEAD_ID = "aa0e8400-e29b-41d4-a716-446655440000";
const ESCROW_ID = "880e8400-e29b-41d4-a716-446655440000";
const HOLD_ID = "990e8400-e29b-41d4-a716-446655440000";

function mockEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: CAMPAIGN_ID,
    affiliateId: AFFILIATE_ID,
    status: "APPROVED",
    trackingCode: "TRACK123",
    ...overrides,
  };
}

function mockCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    advertiserId: ADVERTISER_ID,
    name: "Test Campaign",
    status: "ACTIVE",
    currency: "USD",
    payoutPerUnitCents: 1000,
    compensationModel: "CPL",
    deletedAt: null,
    ...overrides,
  };
}

function mockLead(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAD_ID,
    campaignId: CAMPAIGN_ID,
    affiliateId: AFFILIATE_ID,
    status: "SUBMITTED",
    payoutCents: 1000,
    currency: "USD",
    fingerprintHash: "abc123",
    submittedAt: new Date(),
    ...overrides,
  };
}

function mockEscrowAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: ESCROW_ID,
    campaignId: CAMPAIGN_ID,
    currentBalanceCents: 50000,
    ...overrides,
  };
}

const defaultSubmitInput = {
  campaignId: CAMPAIGN_ID,
  leadData: { email: "test@example.com" },
  externalId: "ext-123",
  ipAddress: "192.168.1.1",
};

// Wire up $transaction to execute callbacks with the same prisma mock
beforeEach(() => {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
  );
});

// ---------------------------------------------------------------------------
// 1. submitLead
// ---------------------------------------------------------------------------

describe("submitLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: creates lead and places escrow hold", async () => {
    const enrollment = mockEnrollment();
    const campaign = mockCampaign();
    const lead = mockLead();
    const escrowAccount = mockEscrowAccount();

    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);
    (prisma.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(campaign);
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null); // no duplicate
    (prisma.lead.count as ReturnType<typeof vi.fn>).mockResolvedValue(0); // no velocity issue
    (prisma.lead.create as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.escrowAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(escrowAccount);
    (escrowService.placeHold as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await submitLead(AFFILIATE_ID, defaultSubmitInput);

    expect(result.id).toBe(LEAD_ID);
    expect(result.status).toBe("SUBMITTED");

    // Verify lead was created with correct data
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: CAMPAIGN_ID,
        affiliateId: AFFILIATE_ID,
        externalId: "ext-123",
        payoutCents: 1000,
        status: "SUBMITTED",
      }),
    });

    // Verify escrow hold was placed
    expect(escrowService.placeHold).toHaveBeenCalledWith(
      ESCROW_ID,
      LEAD_ID,
      AFFILIATE_ID,
      1000
    );

  });

  it("throws ForbiddenError when affiliate is not enrolled", async () => {
    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      submitLead(AFFILIATE_ID, defaultSubmitInput)
    ).rejects.toThrow("enrolled and approved");
  });

  it("throws ForbiddenError when enrollment is not approved", async () => {
    const enrollment = mockEnrollment({ status: "PENDING" });
    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);

    await expect(
      submitLead(AFFILIATE_ID, defaultSubmitInput)
    ).rejects.toThrow("enrolled and approved");
  });

  it("throws NotFoundError when campaign not found", async () => {
    const enrollment = mockEnrollment();
    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);
    (prisma.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      submitLead(AFFILIATE_ID, defaultSubmitInput)
    ).rejects.toThrow("not found");
  });

  it("throws ValidationError when campaign is not active", async () => {
    const enrollment = mockEnrollment();
    const campaign = mockCampaign({ status: "PAUSED" });

    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);
    (prisma.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(campaign);

    await expect(
      submitLead(AFFILIATE_ID, defaultSubmitInput)
    ).rejects.toThrow("active campaigns");
  });

  it("throws ConflictError on duplicate lead detection", async () => {
    const enrollment = mockEnrollment();
    const campaign = mockCampaign();
    const existingLead = mockLead();

    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);
    (prisma.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(campaign);
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existingLead); // duplicate found

    await expect(
      submitLead(AFFILIATE_ID, defaultSubmitInput)
    ).rejects.toThrow("Duplicate lead detected");
  });

  it("maps a P2002 unique-constraint violation to a ConflictError", async () => {
    const enrollment = mockEnrollment();
    const campaign = mockCampaign();

    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);
    (prisma.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(campaign);
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null); // passes fingerprint dedup
    (prisma.lead.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    // Reused externalId from a different IP / outside the 24h window: the DB
    // unique constraint rejects it even though the fingerprint check passed.
    (prisma.lead.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    await expect(
      submitLead(AFFILIATE_ID, defaultSubmitInput)
    ).rejects.toThrow("already exists for this campaign");
  });

  it("flags velocity anomaly when >=10 leads per minute", async () => {
    const enrollment = mockEnrollment();
    const campaign = mockCampaign();
    const lead = mockLead({ status: "PENDING_VERIFICATION" });
    const escrowAccount = mockEscrowAccount();

    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);
    (prisma.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(campaign);
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null); // no duplicate
    (prisma.lead.count as ReturnType<typeof vi.fn>).mockResolvedValue(10); // velocity triggered
    (prisma.lead.create as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.fraudInvestigation.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.escrowAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(escrowAccount);
    (escrowService.placeHold as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await submitLead(AFFILIATE_ID, defaultSubmitInput);

    expect(result.status).toBe("PENDING_VERIFICATION");

    // Verify lead was created with velocity-flagged status
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PENDING_VERIFICATION",
        qualitySignals: expect.objectContaining({
          velocityAnomaly: true,
        }),
      }),
    });

    // Verify fraud investigation was created
    expect(prisma.fraudInvestigation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: AFFILIATE_ID,
        triggerType: "VELOCITY_ANOMALY",
        severity: "MEDIUM",
      }),
    });
  });

  it("throws ValidationError when campaign has no escrow account", async () => {
    const enrollment = mockEnrollment();
    const campaign = mockCampaign();
    const lead = mockLead();

    (prisma.affiliateEnrollment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(enrollment);
    (prisma.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(campaign);
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.lead.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.lead.create as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.escrowAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      submitLead(AFFILIATE_ID, defaultSubmitInput)
    ).rejects.toThrow("no escrow account");
  });
});

// ---------------------------------------------------------------------------
// 2. verifyLead
// ---------------------------------------------------------------------------

describe("verifyLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: updates status, releases hold, recalculates reputation, fires webhook", async () => {
    const lead = mockLead({
      campaign: { advertiserId: ADVERTISER_ID },
    });
    const updatedLead = mockLead({ status: "VERIFIED", verifiedAt: new Date() });
    const hold = { id: HOLD_ID, leadId: LEAD_ID, status: "HELD" };

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(hold);
    (escrowService.releaseHold as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await verifyLead(LEAD_ID, ADVERTISER_ID);

    expect(result.status).toBe("VERIFIED");

    // Verify lead was updated
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: LEAD_ID },
      data: expect.objectContaining({
        status: "VERIFIED",
        verifiedAt: expect.any(Date),
      }),
    });

    // Verify escrow hold was released
    expect(escrowService.releaseHold).toHaveBeenCalledWith(HOLD_ID);

    // Verify reputation was recalculated
    expect(reputationService.recalculateReputation).toHaveBeenCalledWith(AFFILIATE_ID);
  });

  it("verifies a lead in PENDING_VERIFICATION status", async () => {
    const lead = mockLead({
      status: "PENDING_VERIFICATION",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    const updatedLead = mockLead({ status: "VERIFIED" });

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await verifyLead(LEAD_ID, ADVERTISER_ID);

    expect(result.status).toBe("VERIFIED");
  });

  it("throws NotFoundError when lead not found", async () => {
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      verifyLead(LEAD_ID, ADVERTISER_ID)
    ).rejects.toThrow("not found");
  });

  it("throws ForbiddenError when advertiser does not own the campaign", async () => {
    const lead = mockLead({
      campaign: { advertiserId: "different-advertiser" },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      verifyLead(LEAD_ID, ADVERTISER_ID)
    ).rejects.toThrow("Only the campaign owner");
  });

  it("throws ValidationError when lead is already VERIFIED", async () => {
    const lead = mockLead({
      status: "VERIFIED",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      verifyLead(LEAD_ID, ADVERTISER_ID)
    ).rejects.toThrow("cannot be verified from status");
  });

  it("throws ValidationError when lead is REJECTED", async () => {
    const lead = mockLead({
      status: "REJECTED",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      verifyLead(LEAD_ID, ADVERTISER_ID)
    ).rejects.toThrow("cannot be verified from status 'REJECTED'");
  });

  it("skips releaseHold when no hold is found", async () => {
    const lead = mockLead({
      campaign: { advertiserId: ADVERTISER_ID },
    });
    const updatedLead = mockLead({ status: "VERIFIED" });

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await verifyLead(LEAD_ID, ADVERTISER_ID);

    expect(escrowService.releaseHold).not.toHaveBeenCalled();
  });

  it("passes qualityScore and qualitySignals when provided", async () => {
    const lead = mockLead({
      campaign: { advertiserId: ADVERTISER_ID },
    });
    const updatedLead = mockLead({ status: "VERIFIED", qualityScore: 95 });

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await verifyLead(LEAD_ID, ADVERTISER_ID, {
      qualityScore: 95,
      qualitySignals: { source: "verified" },
    });

    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: LEAD_ID },
      data: expect.objectContaining({
        qualityScore: 95,
        qualitySignals: { source: "verified" },
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// 3. rejectLead
// ---------------------------------------------------------------------------

describe("rejectLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: updates status, refunds hold, recalculates reputation, fires webhook", async () => {
    const lead = mockLead({
      campaign: { advertiserId: ADVERTISER_ID },
    });
    const updatedLead = mockLead({
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: "Low quality",
    });
    const hold = { id: HOLD_ID, leadId: LEAD_ID, status: "HELD" };

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(hold);
    (escrowService.refundHold as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await rejectLead(LEAD_ID, ADVERTISER_ID, "Low quality");

    expect(result.status).toBe("REJECTED");

    // Verify lead was updated with rejection data
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: LEAD_ID },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectedAt: expect.any(Date),
        rejectionReason: "Low quality",
      }),
    });

    // Verify escrow hold was refunded
    expect(escrowService.refundHold).toHaveBeenCalledWith(HOLD_ID);

    // Verify reputation was recalculated
    expect(reputationService.recalculateReputation).toHaveBeenCalledWith(AFFILIATE_ID);
  });

  it("rejects a lead in PENDING_VERIFICATION status", async () => {
    const lead = mockLead({
      status: "PENDING_VERIFICATION",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    const updatedLead = mockLead({ status: "REJECTED" });

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await rejectLead(LEAD_ID, ADVERTISER_ID, "Fraud detected");

    expect(result.status).toBe("REJECTED");
  });

  it("throws NotFoundError when lead not found", async () => {
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      rejectLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("not found");
  });

  it("throws ForbiddenError when advertiser does not own the campaign", async () => {
    const lead = mockLead({
      campaign: { advertiserId: "different-advertiser" },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      rejectLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("Only the campaign owner");
  });

  it("throws ValidationError when lead is already VERIFIED", async () => {
    const lead = mockLead({
      status: "VERIFIED",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      rejectLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("cannot be rejected from status 'VERIFIED'");
  });

  it("throws ValidationError when lead is already REJECTED", async () => {
    const lead = mockLead({
      status: "REJECTED",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      rejectLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("cannot be rejected from status 'REJECTED'");
  });

  it("skips refundHold when no hold is found", async () => {
    const lead = mockLead({
      campaign: { advertiserId: ADVERTISER_ID },
    });
    const updatedLead = mockLead({ status: "REJECTED" });

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await rejectLead(LEAD_ID, ADVERTISER_ID, "Bad lead");

    expect(escrowService.refundHold).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. disputeLead
// ---------------------------------------------------------------------------

describe("disputeLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: disputes verified lead with PENDING_RELEASE hold (single transaction)", async () => {
    const lead = mockLead({
      status: "VERIFIED",
      verifiedAt: new Date(),
      campaign: { advertiserId: ADVERTISER_ID, name: "Test Campaign" },
    });
    const updatedLead = mockLead({
      status: "DISPUTED",
      disputedAt: new Date(),
      disputeReason: "Fraudulent lead",
    });
    const hold = {
      id: HOLD_ID,
      leadId: LEAD_ID,
      status: "PENDING_RELEASE",
      escrowId: "escrow-1",
      amountCents: 1000,
      currency: "USD",
      escrowAccount: { campaignId: CAMPAIGN_ID },
    };

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(hold);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.escrowAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.campaign.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.ledgerEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.domainEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await disputeLead(LEAD_ID, ADVERTISER_ID, "Fraudulent lead");

    expect(result.status).toBe("DISPUTED");

    // Verify lead was updated with dispute data
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: LEAD_ID },
      data: expect.objectContaining({
        status: "DISPUTED",
        disputedAt: expect.any(Date),
        disputeReason: "Fraudulent lead",
      }),
    });

    // Verify hold was refunded in the same transaction (not via escrowService.refundHold)
    expect(escrowService.refundHold).not.toHaveBeenCalled();
    expect(prisma.escrowHold.update).toHaveBeenCalledWith({
      where: { id: HOLD_ID },
      data: expect.objectContaining({ status: "REFUNDED" }),
    });

    // Verify escrow balance restored
    expect(prisma.escrowAccount.update).toHaveBeenCalledWith({
      where: { id: "escrow-1" },
      data: expect.objectContaining({
        currentBalanceCents: { increment: 1000 },
        totalReleasedCents: { decrement: 1000 },
      }),
    });

    // Verify reputation was recalculated
    expect(reputationService.recalculateReputation).toHaveBeenCalledWith(AFFILIATE_ID);
  });

  it("throws NotFoundError when lead not found", async () => {
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      disputeLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("not found");
  });

  it("throws ForbiddenError when advertiser does not own the campaign", async () => {
    const lead = mockLead({
      status: "VERIFIED",
      campaign: { advertiserId: "different-advertiser" },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      disputeLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("Only the campaign owner");
  });

  it("throws ValidationError when lead is not in VERIFIED status", async () => {
    const lead = mockLead({
      status: "SUBMITTED",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      disputeLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("cannot be disputed from status 'SUBMITTED'");
  });

  it("throws ValidationError when lead is already REJECTED", async () => {
    const lead = mockLead({
      status: "REJECTED",
      campaign: { advertiserId: ADVERTISER_ID },
    });
    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);

    await expect(
      disputeLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toThrow("cannot be disputed from status 'REJECTED'");
  });

  it("throws DisputeWindowClosedError when hold is not in PENDING_RELEASE (funds already released by cron)", async () => {
    const lead = mockLead({
      status: "VERIFIED",
      campaign: { advertiserId: ADVERTISER_ID, name: "Test Campaign" },
    });

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    // No PENDING_RELEASE hold found — funds already released
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      disputeLead(LEAD_ID, ADVERTISER_ID, "Bad lead")
    ).rejects.toMatchObject({
      code: "DISPUTE_WINDOW_CLOSED",
      statusCode: 409,
      message: expect.stringContaining("holding period has elapsed"),
    });

    // Lead should NOT have been updated since hold check happens first
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("throws DisputeWindowClosedError when hold is still PENDING_RELEASE but releaseAt is in the past (cron-latency race)", async () => {
    // Regression guard for the race window between hold maturity and the
    // processMaturedHolds() cron run: if releaseAt has passed, the hold is
    // economically matured even if the cron hasn't flipped its status yet.
    const lead = mockLead({
      status: "VERIFIED",
      verifiedAt: new Date(),
      campaign: { advertiserId: ADVERTISER_ID, name: "Test Campaign" },
    });
    const matureHold = {
      id: HOLD_ID,
      leadId: LEAD_ID,
      status: "PENDING_RELEASE",
      escrowId: "escrow-1",
      amountCents: 1000,
      currency: "USD",
      releaseAt: new Date(Date.now() - 60_000), // 1 minute past maturity
      escrowAccount: { campaignId: CAMPAIGN_ID },
    };

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(matureHold);

    await expect(
      disputeLead(LEAD_ID, ADVERTISER_ID, "Too late")
    ).rejects.toMatchObject({
      code: "DISPUTE_WINDOW_CLOSED",
      statusCode: 409,
      message: expect.stringContaining("holding period has elapsed"),
    });

    // Lead and escrow must not have been mutated — authoritative rejection.
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.escrowHold.update).not.toHaveBeenCalled();
    expect(prisma.escrowAccount.update).not.toHaveBeenCalled();
  });

  it("allows dispute when hold is PENDING_RELEASE and releaseAt is in the future (within window)", async () => {
    const lead = mockLead({
      status: "VERIFIED",
      verifiedAt: new Date(),
      campaign: { advertiserId: ADVERTISER_ID, name: "Test Campaign" },
    });
    const futureHold = {
      id: HOLD_ID,
      leadId: LEAD_ID,
      status: "PENDING_RELEASE",
      escrowId: "escrow-1",
      amountCents: 1000,
      currency: "USD",
      releaseAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day ahead
      escrowAccount: { campaignId: CAMPAIGN_ID },
    };
    const updatedLead = mockLead({
      status: "DISPUTED",
      disputedAt: new Date(),
      disputeReason: "In window",
    });

    (prisma.lead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(lead);
    (prisma.escrowHold.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(futureHold);
    (prisma.lead.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedLead);
    (prisma.escrowHold.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.escrowAccount.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.campaign.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.ledgerEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.domainEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (reputationService.recalculateReputation as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await disputeLead(LEAD_ID, ADVERTISER_ID, "In window");
    expect(result.status).toBe("DISPUTED");
  });
});
