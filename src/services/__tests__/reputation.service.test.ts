import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock external modules before importing anything that uses them
// ---------------------------------------------------------------------------

const mockTx = {
  fraudInvestigation: { create: vi.fn() },
  agentReputation: { updateMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentReputation: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    agent: {
      findFirst: vi.fn(),
    },
    lead: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    conversionEvent: {
      count: vi.fn(),
    },
    fraudInvestigation: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    peerRating: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    campaign: {
      findFirst: vi.fn(),
    },
    domainEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    ),
  },
}));

// ---------------------------------------------------------------------------
// Imports (loaded after mocks)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import {
  getReputation,
  recalculateReputation,
  determineTrustTier,
  submitRating,
  listRatings,
  flagFraud,
  listFraudInvestigations,
} from "@/services/reputation.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const FROM_AGENT_ID = "550e8400-e29b-41d4-a716-446655440001";
const CAMPAIGN_ID = "660e8400-e29b-41d4-a716-446655440000";
const REPUTATION_ID = "770e8400-e29b-41d4-a716-446655440000";

function mockAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    displayName: "Test Agent",
    type: "AFFILIATE",
    deletedAt: null,
    ...overrides,
  };
}

function mockReputationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: REPUTATION_ID,
    agentId: AGENT_ID,
    trustTier: "VERIFIED",
    overallScore: 55,
    dimensionScores: {
      leadQuality: 60,
      conversionRate: 50,
      paymentReliability: 80,
      responseTime: 50,
      peerRating: 50,
    },
    totalLeadsSubmitted: 100,
    totalLeadsVerified: 60,
    totalLeadsRejected: 10,
    totalConversions: 30,
    fraudFlagCount: 1,
    lastRecalculatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Typed cast helpers
const agentReputationFindUnique = prisma.agentReputation
  .findUnique as ReturnType<typeof vi.fn>;
const agentReputationUpsert = prisma.agentReputation.upsert as ReturnType<
  typeof vi.fn
>;
const agentFindFirst = prisma.agent.findFirst as ReturnType<typeof vi.fn>;
const leadCount = prisma.lead.count as ReturnType<typeof vi.fn>;
const leadFindMany = prisma.lead.findMany as ReturnType<typeof vi.fn>;
const conversionEventCount = prisma.conversionEvent.count as ReturnType<
  typeof vi.fn
>;
const fraudInvestigationCount = prisma.fraudInvestigation.count as ReturnType<
  typeof vi.fn
>;
const fraudInvestigationFindMany = prisma.fraudInvestigation
  .findMany as ReturnType<typeof vi.fn>;
const peerRatingFindMany = prisma.peerRating.findMany as ReturnType<
  typeof vi.fn
>;
const peerRatingFindUnique = prisma.peerRating.findUnique as ReturnType<
  typeof vi.fn
>;
const peerRatingCount = prisma.peerRating.count as ReturnType<typeof vi.fn>;
const peerRatingCreate = prisma.peerRating.create as ReturnType<typeof vi.fn>;
const campaignFindFirst = prisma.campaign.findFirst as ReturnType<
  typeof vi.fn
>;
const domainEventCreate = prisma.domainEvent.create as ReturnType<
  typeof vi.fn
>;

// Helper to set up all the Promise.all mocks used by recalculateReputation.
// prisma.lead.count is called twice (total, verified, rejected uses the same fn),
// so we chain mockResolvedValueOnce calls.
function setupRecalculateMocks(opts: {
  totalLeadsSubmitted?: number;
  totalLeadsVerified?: number;
  totalLeadsRejected?: number;
  totalConversions?: number;
  fraudFlagCount?: number;
  peerRatings?: { score: number }[];
  recentLeads?: {
    status: string;
    qualityScore: number | null;
    submittedAt: Date;
    verifiedAt: Date | null;
  }[];
} = {}) {
  const {
    totalLeadsSubmitted = 100,
    totalLeadsVerified = 60,
    totalLeadsRejected = 10,
    totalConversions = 30,
    fraudFlagCount = 1,
    peerRatings = [{ score: 4 }, { score: 3 }],
    recentLeads = [],
  } = opts;

  // lead.count is called 3 times: total, verified, rejected
  leadCount
    .mockResolvedValueOnce(totalLeadsSubmitted)
    .mockResolvedValueOnce(totalLeadsVerified)
    .mockResolvedValueOnce(totalLeadsRejected);

  conversionEventCount.mockResolvedValue(totalConversions);
  fraudInvestigationCount.mockResolvedValue(fraudFlagCount);
  peerRatingFindMany.mockResolvedValue(peerRatings);
  leadFindMany.mockResolvedValue(recentLeads);
}

// ---------------------------------------------------------------------------
// 1. getReputation
// ---------------------------------------------------------------------------

describe("getReputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reputation when found", async () => {
    const reputation = mockReputationRecord();
    agentReputationFindUnique.mockResolvedValue(reputation);

    const result = await getReputation(AGENT_ID);

    expect(result).toEqual(reputation);
    expect(agentReputationFindUnique).toHaveBeenCalledWith({
      where: { agentId: AGENT_ID },
    });
  });

  it("throws NotFoundError when not found", async () => {
    agentReputationFindUnique.mockResolvedValue(null);

    await expect(getReputation(AGENT_ID)).rejects.toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// 2. recalculateReputation
// ---------------------------------------------------------------------------

describe("recalculateReputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NotFoundError when agent does not exist", async () => {
    agentFindFirst.mockResolvedValue(null);

    await expect(recalculateReputation(AGENT_ID)).rejects.toThrow("not found");
  });

  it("creates reputation via upsert if it does not exist yet", async () => {
    const agent = mockAgent();
    const upsertedReputation = mockReputationRecord();

    agentFindFirst.mockResolvedValue(agent);
    setupRecalculateMocks();
    agentReputationUpsert.mockResolvedValue(upsertedReputation);
    domainEventCreate.mockResolvedValue({});

    const result = await recalculateReputation(AGENT_ID);

    expect(result).toEqual(upsertedReputation);

    // Verify upsert was called (works for both create and update)
    expect(agentReputationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: AGENT_ID },
        create: expect.objectContaining({ agentId: AGENT_ID }),
        update: expect.objectContaining({
          totalLeadsSubmitted: 100,
          totalLeadsVerified: 60,
        }),
      })
    );
  });

  it("computes lead quality score from recent leads with qualityScore", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    const now = new Date();
    const recentLeads = [
      { status: "VERIFIED", qualityScore: 80, submittedAt: now, verifiedAt: now },
      { status: "VERIFIED", qualityScore: 60, submittedAt: now, verifiedAt: now },
    ];
    // Average qualityScore = 70

    setupRecalculateMocks({ recentLeads });

    agentReputationUpsert.mockImplementation((args: Record<string, unknown>) => args.create);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    const upsertCall = agentReputationUpsert.mock.calls[0][0];
    const dimensions = upsertCall.create.dimensionScores;
    expect(dimensions.leadQuality).toBe(70);
  });

  it("defaults lead quality to 50 when leads exist but none have qualityScore", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    const now = new Date();
    const recentLeads = [
      { status: "VERIFIED", qualityScore: null, submittedAt: now, verifiedAt: now },
    ];

    setupRecalculateMocks({ totalLeadsSubmitted: 10, recentLeads });

    agentReputationUpsert.mockImplementation((args: Record<string, unknown>) => args.create);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    const upsertCall = agentReputationUpsert.mock.calls[0][0];
    expect(upsertCall.create.dimensionScores.leadQuality).toBe(50);
  });

  it("defaults lead quality to 0 when no leads submitted", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    setupRecalculateMocks({
      totalLeadsSubmitted: 0,
      totalLeadsVerified: 0,
      totalLeadsRejected: 0,
      totalConversions: 0,
      recentLeads: [],
    });

    agentReputationUpsert.mockImplementation((args: Record<string, unknown>) => args.create);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    const upsertCall = agentReputationUpsert.mock.calls[0][0];
    expect(upsertCall.create.dimensionScores.leadQuality).toBe(0);
  });

  it("computes conversion rate score as verified / total * 100", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    // 60 verified out of 100 total => 60%
    setupRecalculateMocks({ totalLeadsSubmitted: 100, totalLeadsVerified: 60 });

    agentReputationUpsert.mockImplementation((args: Record<string, unknown>) => args.create);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    const upsertCall = agentReputationUpsert.mock.calls[0][0];
    expect(upsertCall.create.dimensionScores.conversionRate).toBe(60);
  });

  it("computes overall score with proper weights (30% lead, 25% conv, 20% payment, 15% response, 10% peer)", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    // Set up known dimension scores:
    // leadQuality: 80 (from qualityScore average)
    // conversionRate: 50 (50 verified / 100 total)
    // paymentReliability: 100 (0 fraud flags => 100 - 0*20 = 100)
    // responseTime: 50 (default, no verified leads with dates)
    // peerRating: 80 (avg score 4 out of 5 => 4/5*100 = 80)
    const now = new Date();
    setupRecalculateMocks({
      totalLeadsSubmitted: 100,
      totalLeadsVerified: 50,
      totalLeadsRejected: 5,
      totalConversions: 20,
      fraudFlagCount: 0,
      peerRatings: [{ score: 4 }, { score: 4 }],
      recentLeads: [
        { status: "VERIFIED", qualityScore: 80, submittedAt: now, verifiedAt: null },
      ],
    });

    agentReputationUpsert.mockImplementation((args: Record<string, unknown>) => args.create);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    const upsertCall = agentReputationUpsert.mock.calls[0][0];
    const dims = upsertCall.create.dimensionScores;

    // Verify dimension values
    expect(dims.leadQuality).toBe(80);
    expect(dims.conversionRate).toBe(50);
    expect(dims.paymentReliability).toBe(100);
    expect(dims.responseTime).toBe(50); // default, no verifiedAt
    expect(dims.peerRating).toBe(80);

    // Weighted: 80*0.3 + 50*0.25 + 100*0.2 + 50*0.15 + 80*0.1
    // = 24 + 12.5 + 20 + 7.5 + 8 = 72
    expect(upsertCall.create.overallScore).toBe(72);
  });

  it("updates totalLeadsSubmitted, totalLeadsVerified, totalLeadsRejected, totalConversions", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    setupRecalculateMocks({
      totalLeadsSubmitted: 200,
      totalLeadsVerified: 120,
      totalLeadsRejected: 30,
      totalConversions: 50,
    });

    agentReputationUpsert.mockImplementation((args: Record<string, unknown>) => args.create);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    const upsertCall = agentReputationUpsert.mock.calls[0][0];
    expect(upsertCall.create.totalLeadsSubmitted).toBe(200);
    expect(upsertCall.create.totalLeadsVerified).toBe(120);
    expect(upsertCall.create.totalLeadsRejected).toBe(30);
    expect(upsertCall.create.totalConversions).toBe(50);

    // update path should have the same values
    expect(upsertCall.update.totalLeadsSubmitted).toBe(200);
    expect(upsertCall.update.totalLeadsVerified).toBe(120);
    expect(upsertCall.update.totalLeadsRejected).toBe(30);
    expect(upsertCall.update.totalConversions).toBe(50);
  });

  it("updates fraudFlagCount from fraud investigations", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    setupRecalculateMocks({ fraudFlagCount: 3 });

    agentReputationUpsert.mockImplementation((args: Record<string, unknown>) => args.create);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    const upsertCall = agentReputationUpsert.mock.calls[0][0];
    expect(upsertCall.create.fraudFlagCount).toBe(3);
    expect(upsertCall.update.fraudFlagCount).toBe(3);

    // paymentReliability should be penalized: 100 - 3*20 = 40
    expect(upsertCall.create.dimensionScores.paymentReliability).toBe(40);
  });

  it("emits a ReputationRecalculated domain event", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    setupRecalculateMocks();

    const upsertedReputation = mockReputationRecord();
    agentReputationUpsert.mockResolvedValue(upsertedReputation);
    domainEventCreate.mockResolvedValue({});

    await recalculateReputation(AGENT_ID);

    expect(domainEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: "AgentReputation",
        aggregateId: REPUTATION_ID,
        eventType: "ReputationRecalculated",
        version: 1,
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// 3. determineTrustTier
// ---------------------------------------------------------------------------

describe("determineTrustTier", () => {
  it("returns NEW for score 0", () => {
    expect(determineTrustTier(0)).toBe("NEW");
  });

  it("returns NEW for score 30", () => {
    expect(determineTrustTier(30)).toBe("NEW");
  });

  it("returns VERIFIED for score 31", () => {
    expect(determineTrustTier(31)).toBe("VERIFIED");
  });

  it("returns VERIFIED for score 60", () => {
    expect(determineTrustTier(60)).toBe("VERIFIED");
  });

  it("returns TRUSTED for score 61", () => {
    expect(determineTrustTier(61)).toBe("TRUSTED");
  });

  it("returns TRUSTED for score 85", () => {
    expect(determineTrustTier(85)).toBe("TRUSTED");
  });

  it("returns PREMIUM for score 86", () => {
    expect(determineTrustTier(86)).toBe("PREMIUM");
  });

  it("returns PREMIUM for score 100", () => {
    expect(determineTrustTier(100)).toBe("PREMIUM");
  });
});

// ---------------------------------------------------------------------------
// 4. submitRating
// ---------------------------------------------------------------------------

describe("submitRating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: creates a peer rating and emits domain event", async () => {
    const fromAgent = mockAgent({ id: FROM_AGENT_ID });
    const toAgent = mockAgent({ id: AGENT_ID });
    const ratingData = { campaignId: CAMPAIGN_ID, score: 4, comment: "Good" };
    const createdRating = {
      id: "rating-1",
      fromAgentId: FROM_AGENT_ID,
      toAgentId: AGENT_ID,
      campaignId: CAMPAIGN_ID,
      score: 4,
      comment: "Good",
    };

    agentFindFirst
      .mockResolvedValueOnce(fromAgent)
      .mockResolvedValueOnce(toAgent);
    campaignFindFirst.mockResolvedValue({ id: CAMPAIGN_ID, deletedAt: null });
    peerRatingFindUnique.mockResolvedValue(null);
    peerRatingCreate.mockResolvedValue(createdRating);
    domainEventCreate.mockResolvedValue({});

    const result = await submitRating(FROM_AGENT_ID, AGENT_ID, ratingData);

    expect(result).toEqual(createdRating);
    expect(peerRatingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromAgentId: FROM_AGENT_ID,
        toAgentId: AGENT_ID,
        campaignId: CAMPAIGN_ID,
        score: 4,
      }),
    });
    expect(domainEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: "PeerRating",
        eventType: "PeerRatingSubmitted",
      }),
    });
  });

  it("throws ValidationError when rating yourself", async () => {
    await expect(
      submitRating(AGENT_ID, AGENT_ID, {
        campaignId: CAMPAIGN_ID,
        score: 5,
      })
    ).rejects.toThrow("cannot rate yourself");
  });

  it("throws NotFoundError when fromAgent does not exist", async () => {
    agentFindFirst.mockResolvedValueOnce(null);

    await expect(
      submitRating(FROM_AGENT_ID, AGENT_ID, {
        campaignId: CAMPAIGN_ID,
        score: 4,
      })
    ).rejects.toThrow("not found");
  });

  it("throws NotFoundError when toAgent does not exist", async () => {
    agentFindFirst
      .mockResolvedValueOnce(mockAgent({ id: FROM_AGENT_ID }))
      .mockResolvedValueOnce(null);

    await expect(
      submitRating(FROM_AGENT_ID, AGENT_ID, {
        campaignId: CAMPAIGN_ID,
        score: 4,
      })
    ).rejects.toThrow("not found");
  });

  it("throws NotFoundError when campaign does not exist", async () => {
    agentFindFirst
      .mockResolvedValueOnce(mockAgent({ id: FROM_AGENT_ID }))
      .mockResolvedValueOnce(mockAgent({ id: AGENT_ID }));
    campaignFindFirst.mockResolvedValue(null);

    await expect(
      submitRating(FROM_AGENT_ID, AGENT_ID, {
        campaignId: CAMPAIGN_ID,
        score: 4,
      })
    ).rejects.toThrow("not found");
  });

  it("throws ConflictError for duplicate rating", async () => {
    agentFindFirst
      .mockResolvedValueOnce(mockAgent({ id: FROM_AGENT_ID }))
      .mockResolvedValueOnce(mockAgent({ id: AGENT_ID }));
    campaignFindFirst.mockResolvedValue({ id: CAMPAIGN_ID, deletedAt: null });
    peerRatingFindUnique.mockResolvedValue({ id: "existing-rating" });

    await expect(
      submitRating(FROM_AGENT_ID, AGENT_ID, {
        campaignId: CAMPAIGN_ID,
        score: 4,
      })
    ).rejects.toThrow("already submitted");
  });
});

// ---------------------------------------------------------------------------
// 5. listRatings
// ---------------------------------------------------------------------------

describe("listRatings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated ratings", async () => {
    const ratings = [
      { id: "r1", score: 5, toAgentId: AGENT_ID },
      { id: "r2", score: 3, toAgentId: AGENT_ID },
    ];

    peerRatingFindMany.mockResolvedValue(ratings);
    peerRatingCount.mockResolvedValue(2);

    const result = await listRatings(AGENT_ID, { page: 1, pageSize: 10 });

    expect(result.ratings).toEqual(ratings);
    expect(result.totalCount).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("applies campaignId filter", async () => {
    peerRatingFindMany.mockResolvedValue([]);
    peerRatingCount.mockResolvedValue(0);

    await listRatings(AGENT_ID, {
      page: 1,
      pageSize: 10,
      campaignId: CAMPAIGN_ID,
    });

    expect(peerRatingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          toAgentId: AGENT_ID,
          campaignId: CAMPAIGN_ID,
        }),
      })
    );
  });

  it("applies minScore and maxScore filters", async () => {
    peerRatingFindMany.mockResolvedValue([]);
    peerRatingCount.mockResolvedValue(0);

    await listRatings(AGENT_ID, {
      page: 1,
      pageSize: 10,
      minScore: 3,
      maxScore: 5,
    });

    expect(peerRatingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          toAgentId: AGENT_ID,
          score: { gte: 3, lte: 5 },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 6. flagFraud
// ---------------------------------------------------------------------------

describe("flagFraud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: creates fraud investigation and increments flag count", async () => {
    const agent = mockAgent();
    agentFindFirst.mockResolvedValue(agent);

    const investigation = {
      id: "inv-1",
      agentId: AGENT_ID,
      triggerType: "DUPLICATE_PATTERN",
      severity: "HIGH",
      status: "OPEN",
    };

    mockTx.fraudInvestigation.create.mockResolvedValue(investigation);
    mockTx.agentReputation.updateMany.mockResolvedValue({ count: 1 });
    domainEventCreate.mockResolvedValue({});

    const result = await flagFraud(AGENT_ID, {
      type: "DUPLICATE_PATTERN",
      triggerEvent: "lead-123",
      severity: "HIGH",
    });

    expect(result).toEqual(investigation);

    // Verify investigation was created
    expect(mockTx.fraudInvestigation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: AGENT_ID,
        triggerType: "DUPLICATE_PATTERN",
        severity: "HIGH",
        status: "OPEN",
      }),
    });

    // Verify reputation fraud count was incremented
    expect(mockTx.agentReputation.updateMany).toHaveBeenCalledWith({
      where: { agentId: AGENT_ID },
      data: { fraudFlagCount: { increment: 1 } },
    });

    // Verify domain event was emitted
    expect(domainEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: "FraudInvestigation",
        eventType: "FraudFlagged",
      }),
    });
  });

  it("throws NotFoundError when agent does not exist", async () => {
    agentFindFirst.mockResolvedValue(null);

    await expect(
      flagFraud(AGENT_ID, {
        type: "DUPLICATE_PATTERN",
        triggerEvent: "lead-123",
        severity: "HIGH",
      })
    ).rejects.toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// 7. listFraudInvestigations
// ---------------------------------------------------------------------------

describe("listFraudInvestigations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated investigations", async () => {
    const investigations = [
      { id: "inv-1", agentId: AGENT_ID, status: "OPEN" },
    ];

    fraudInvestigationFindMany.mockResolvedValue(investigations);
    fraudInvestigationCount.mockResolvedValue(1);

    const result = await listFraudInvestigations(AGENT_ID, {
      page: 1,
      pageSize: 10,
    });

    expect(result.investigations).toEqual(investigations);
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("applies status filter", async () => {
    fraudInvestigationFindMany.mockResolvedValue([]);
    fraudInvestigationCount.mockResolvedValue(0);

    await listFraudInvestigations(AGENT_ID, {
      page: 1,
      pageSize: 10,
      status: "OPEN",
    });

    expect(fraudInvestigationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agentId: AGENT_ID,
          status: "OPEN",
        }),
      })
    );
  });

  it("applies severity filter", async () => {
    fraudInvestigationFindMany.mockResolvedValue([]);
    fraudInvestigationCount.mockResolvedValue(0);

    await listFraudInvestigations(AGENT_ID, {
      page: 1,
      pageSize: 10,
      severity: "HIGH",
    });

    expect(fraudInvestigationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agentId: AGENT_ID,
          severity: "HIGH",
        }),
      })
    );
  });
});
