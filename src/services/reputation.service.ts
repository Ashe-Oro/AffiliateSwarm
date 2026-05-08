import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/errors";
import type {
  SubmitRatingInput,
  ListRatingsInput,
  FlagFraudInput,
  ListFraudInvestigationsInput,
} from "@/lib/validators/reputation";
import type { Prisma, TrustTier } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DimensionScores {
  leadQuality: number;
  conversionRate: number;
  paymentReliability: number;
  responseTime: number;
  peerRating: number;
}

const DIMENSION_WEIGHTS: Record<keyof DimensionScores, number> = {
  leadQuality: 0.3,
  conversionRate: 0.25,
  paymentReliability: 0.2,
  responseTime: 0.15,
  peerRating: 0.1,
};

// ---------------------------------------------------------------------------
// Get Reputation
// ---------------------------------------------------------------------------

export async function getReputation(agentId: string) {
  const reputation = await prisma.agentReputation.findUnique({
    where: { agentId },
  });

  if (!reputation) {
    throw new NotFoundError("Reputation for agent", agentId);
  }

  return reputation;
}

// ---------------------------------------------------------------------------
// Recalculate Reputation
// ---------------------------------------------------------------------------

export async function recalculateReputation(agentId: string) {
  // Verify agent exists
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  // Gather statistics
  const [
    totalLeadsSubmitted,
    totalLeadsVerified,
    totalLeadsRejected,
    totalConversions,
    fraudFlagCount,
    peerRatings,
    recentLeads,
  ] = await Promise.all([
    prisma.lead.count({ where: { affiliateId: agentId } }),
    prisma.lead.count({ where: { affiliateId: agentId, status: "VERIFIED" } }),
    prisma.lead.count({ where: { affiliateId: agentId, status: "REJECTED" } }),
    prisma.conversionEvent.count({
      where: { affiliateId: agentId, status: "VERIFIED" },
    }),
    prisma.fraudInvestigation.count({
      where: { agentId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
    }),
    prisma.peerRating.findMany({
      where: { toAgentId: agentId },
      select: { score: true },
    }),
    prisma.lead.findMany({
      where: { affiliateId: agentId },
      select: {
        status: true,
        qualityScore: true,
        submittedAt: true,
        verifiedAt: true,
      },
      orderBy: { submittedAt: "desc" },
      take: 200,
    }),
  ]);

  // Calculate dimension scores (each 0-100)
  const dimensions = calculateDimensionScores({
    totalLeadsSubmitted,
    totalLeadsVerified,
    totalLeadsRejected,
    totalConversions,
    fraudFlagCount,
    peerRatings,
    recentLeads,
  });

  // Weighted average for overall score
  const overallScore = Math.round(
    Object.entries(DIMENSION_WEIGHTS).reduce(
      (sum, [key, weight]) =>
        sum + dimensions[key as keyof DimensionScores] * weight,
      0
    )
  );

  const trustTier = determineTrustTier(overallScore);

  // Update reputation record
  const updated = await prisma.agentReputation.upsert({
    where: { agentId },
    create: {
      agentId,
      trustTier,
      overallScore,
      dimensionScores: dimensions as unknown as Prisma.InputJsonValue,
      totalLeadsSubmitted,
      totalLeadsVerified,
      totalLeadsRejected,
      totalConversions,
      fraudFlagCount,
      lastRecalculatedAt: new Date(),
    },
    update: {
      trustTier,
      overallScore,
      dimensionScores: dimensions as unknown as Prisma.InputJsonValue,
      totalLeadsSubmitted,
      totalLeadsVerified,
      totalLeadsRejected,
      totalConversions,
      fraudFlagCount,
      lastRecalculatedAt: new Date(),
    },
  });

  // Emit domain event
  await prisma.domainEvent.create({
    data: {
      aggregateType: "AgentReputation",
      aggregateId: updated.id,
      eventType: "ReputationRecalculated",
      payload: {
        agentId,
        overallScore,
        trustTier,
        dimensions,
      } as unknown as Prisma.InputJsonValue,
      version: 1,
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Determine Trust Tier
// ---------------------------------------------------------------------------

export function determineTrustTier(overallScore: number): TrustTier {
  if (overallScore >= 86) return "PREMIUM";
  if (overallScore >= 61) return "TRUSTED";
  if (overallScore >= 31) return "VERIFIED";
  return "NEW";
}

// ---------------------------------------------------------------------------
// Submit Rating
// ---------------------------------------------------------------------------

export async function submitRating(
  fromAgentId: string,
  toAgentId: string,
  data: SubmitRatingInput
) {
  if (fromAgentId === toAgentId) {
    throw new ValidationError("You cannot rate yourself");
  }

  // Verify both agents exist
  const [fromAgent, toAgent] = await Promise.all([
    prisma.agent.findFirst({ where: { id: fromAgentId, deletedAt: null } }),
    prisma.agent.findFirst({ where: { id: toAgentId, deletedAt: null } }),
  ]);

  if (!fromAgent) {
    throw new NotFoundError("Agent", fromAgentId);
  }

  if (!toAgent) {
    throw new NotFoundError("Agent", toAgentId);
  }

  // Verify campaign exists
  const campaign = await prisma.campaign.findFirst({
    where: { id: data.campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", data.campaignId);
  }

  // Check for duplicate rating
  const existing = await prisma.peerRating.findUnique({
    where: {
      fromAgentId_toAgentId_campaignId: {
        fromAgentId,
        toAgentId,
        campaignId: data.campaignId,
      },
    },
  });

  if (existing) {
    throw new ConflictError(
      "You have already submitted a rating for this agent on this campaign"
    );
  }

  const rating = await prisma.peerRating.create({
    data: {
      fromAgentId,
      toAgentId,
      campaignId: data.campaignId,
      score: data.score,
      dimensions: (data.dimensions as Prisma.InputJsonValue) ?? undefined,
      comment: data.comment,
    },
  });

  // Emit domain event
  await prisma.domainEvent.create({
    data: {
      aggregateType: "PeerRating",
      aggregateId: rating.id,
      eventType: "PeerRatingSubmitted",
      payload: {
        ratingId: rating.id,
        fromAgentId,
        toAgentId,
        campaignId: data.campaignId,
        score: data.score,
      } as unknown as Prisma.InputJsonValue,
      version: 1,
    },
  });

  return rating;
}

// ---------------------------------------------------------------------------
// List Ratings
// ---------------------------------------------------------------------------

export async function listRatings(
  agentId: string,
  filters: ListRatingsInput
) {
  const where: Prisma.PeerRatingWhereInput = {
    toAgentId: agentId,
  };

  if (filters.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters.minScore !== undefined || filters.maxScore !== undefined) {
    where.score = {};
    if (filters.minScore !== undefined) {
      where.score.gte = filters.minScore;
    }
    if (filters.maxScore !== undefined) {
      where.score.lte = filters.maxScore;
    }
  }

  const [ratings, totalCount] = await Promise.all([
    prisma.peerRating.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        fromAgent: {
          select: { id: true, displayName: true, type: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.peerRating.count({ where }),
  ]);

  return {
    ratings,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Flag Fraud
// ---------------------------------------------------------------------------

export async function flagFraud(
  agentId: string,
  data: FlagFraudInput
) {
  // Verify agent exists
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  const investigation = await prisma.$transaction(async (tx) => {
    const inv = await tx.fraudInvestigation.create({
      data: {
        agentId,
        triggerType: data.type,
        triggerEvent: data.triggerEvent,
        severity: data.severity,
        signals: (data.signals as unknown as Prisma.InputJsonValue) ?? undefined,
        status: "OPEN",
      },
    });

    // Increment fraud flag count on reputation
    await tx.agentReputation.updateMany({
      where: { agentId },
      data: { fraudFlagCount: { increment: 1 } },
    });

    return inv;
  });

  // Emit domain event
  await prisma.domainEvent.create({
    data: {
      aggregateType: "FraudInvestigation",
      aggregateId: investigation.id,
      eventType: "FraudFlagged",
      payload: {
        investigationId: investigation.id,
        agentId,
        type: data.type,
        severity: data.severity,
      } as unknown as Prisma.InputJsonValue,
      version: 1,
    },
  });

  return investigation;
}

// ---------------------------------------------------------------------------
// List Fraud Investigations
// ---------------------------------------------------------------------------

export async function listFraudInvestigations(
  agentId: string,
  filters: ListFraudInvestigationsInput
) {
  const where: Prisma.FraudInvestigationWhereInput = {
    agentId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.severity) {
    where.severity = filters.severity;
  }

  const [investigations, totalCount] = await Promise.all([
    prisma.fraudInvestigation.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { openedAt: "desc" },
    }),
    prisma.fraudInvestigation.count({ where }),
  ]);

  return {
    investigations,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Internal: Calculate Dimension Scores
// ---------------------------------------------------------------------------

interface ReputationStats {
  totalLeadsSubmitted: number;
  totalLeadsVerified: number;
  totalLeadsRejected: number;
  totalConversions: number;
  fraudFlagCount: number;
  peerRatings: { score: number }[];
  recentLeads: {
    status: string;
    qualityScore: number | null;
    submittedAt: Date;
    verifiedAt: Date | null;
  }[];
}

function calculateDimensionScores(stats: ReputationStats): DimensionScores {
  // Lead Quality: based on quality scores of recent leads
  const leadsWithQuality = stats.recentLeads.filter(
    (l) => l.qualityScore !== null
  );
  const leadQuality =
    leadsWithQuality.length > 0
      ? Math.round(
          leadsWithQuality.reduce((sum, l) => sum + (l.qualityScore ?? 0), 0) /
            leadsWithQuality.length
        )
      : stats.totalLeadsSubmitted > 0
        ? 50
        : 0;

  // Conversion Rate: verified leads / total submitted
  const conversionRate =
    stats.totalLeadsSubmitted > 0
      ? Math.min(
          100,
          Math.round(
            (stats.totalLeadsVerified / stats.totalLeadsSubmitted) * 100
          )
        )
      : 0;

  // Payment Reliability: penalize for fraud flags, reward for clean history
  const paymentReliability = Math.max(
    0,
    Math.min(100, 100 - stats.fraudFlagCount * 20)
  );

  // Response Time: based on time between submission and verification
  const verifiedLeads = stats.recentLeads.filter(
    (l) => l.verifiedAt !== null
  );
  let responseTime = 50; // default
  if (verifiedLeads.length > 0) {
    const avgResponseHours =
      verifiedLeads.reduce((sum, l) => {
        const diff =
          (l.verifiedAt!.getTime() - l.submittedAt.getTime()) / 3600000;
        return sum + diff;
      }, 0) / verifiedLeads.length;
    // Under 1h = 100, over 72h = 0, linear scale
    responseTime = Math.max(
      0,
      Math.min(100, Math.round(100 - (avgResponseHours / 72) * 100))
    );
  }

  // Peer Rating: average of peer ratings scaled to 0-100
  const peerRating =
    stats.peerRatings.length > 0
      ? Math.round(
          (stats.peerRatings.reduce((sum, r) => sum + r.score, 0) /
            stats.peerRatings.length /
            5) *
            100
        )
      : 50; // neutral default

  return {
    leadQuality: clamp(leadQuality, 0, 100),
    conversionRate: clamp(conversionRate, 0, 100),
    paymentReliability: clamp(paymentReliability, 0, 100),
    responseTime: clamp(responseTime, 0, 100),
    peerRating: clamp(peerRating, 0, 100),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
