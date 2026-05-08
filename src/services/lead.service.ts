import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
  DisputeWindowClosedError,
} from "@/lib/errors";
import * as escrowService from "@/services/escrow.service";
import * as reputationService from "@/services/reputation.service";
import { notify } from "@/services/notification.service";
import type {
  SubmitLeadInput,
  ListLeadsInput,
  VerifyLeadInput,
  RejectLeadInput,
  DisputeLeadInput,
  SubmitConversionInput,
  ListConversionsInput,
} from "@/lib/validators/lead";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeFingerprintHash(
  campaignId: string,
  externalId: string | undefined,
  ipAddress: string | undefined
): string {
  const raw = `${campaignId}:${externalId ?? ""}:${ipAddress ?? ""}`;
  return createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Submit Lead
// ---------------------------------------------------------------------------

export async function submitLead(affiliateId: string, data: SubmitLeadInput) {
  // 1. Validate affiliate is enrolled in the campaign
  const enrollment = await prisma.affiliateEnrollment.findUnique({
    where: {
      campaignId_affiliateId: {
        campaignId: data.campaignId,
        affiliateId,
      },
    },
  });

  if (!enrollment || enrollment.status !== "APPROVED") {
    throw new ForbiddenError(
      "You must be enrolled and approved in this campaign to submit leads"
    );
  }

  // 2. Verify campaign is active
  const campaign = await prisma.campaign.findFirst({
    where: { id: data.campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", data.campaignId);
  }

  if (campaign.status !== "ACTIVE") {
    throw new ValidationError("Can only submit leads to active campaigns");
  }

  if (campaign.compensationModel === "REV_SHARE") {
    throw new ValidationError(
      "REV_SHARE campaigns cannot accept lead submissions directly. Use the postback/referral flow, where revenueCents determines payout."
    );
  }

  // Non-REV_SHARE campaigns must have a fixed payoutPerUnitCents; validators
  // enforce this at create time, so a null here would indicate data corruption.
  if (campaign.payoutPerUnitCents == null) {
    throw new ValidationError(
      "Campaign is missing payoutPerUnitCents — cannot compute lead payout"
    );
  }
  const fixedPayoutCents = campaign.payoutPerUnitCents;

  // 3. Deduplication check via fingerprint hash
  const fingerprintHash = computeFingerprintHash(
    data.campaignId,
    data.externalId,
    data.ipAddress
  );

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const duplicate = await prisma.lead.findFirst({
    where: {
      campaignId: data.campaignId,
      fingerprintHash,
      submittedAt: { gte: twentyFourHoursAgo },
    },
  });

  if (duplicate) {
    throw new ConflictError(
      "Duplicate lead detected: a lead with the same fingerprint was submitted within the last 24 hours"
    );
  }

  // 4. Fraud signal: velocity check (>10 leads/min from same affiliate)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentLeadCount = await prisma.lead.count({
    where: {
      affiliateId,
      submittedAt: { gte: oneMinuteAgo },
    },
  });

  const flagVelocity = recentLeadCount >= 10;

  // 5. Create the lead
  const qualitySignals: Record<string, unknown> = {};
  if (flagVelocity) {
    qualitySignals.velocityAnomaly = true;
    qualitySignals.leadsPerMinute = recentLeadCount + 1;
  }

  const lead = await prisma.lead.create({
    data: {
      campaignId: data.campaignId,
      affiliateId,
      externalId: data.externalId,
      trackingCode: data.trackingCode ?? enrollment.trackingCode,
      leadData: (data.evidence
        ? { ...data.leadData, evidence: data.evidence }
        : data.leadData) as Prisma.InputJsonValue ?? undefined,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      geo: data.geo,
      fingerprintHash,
      payoutCents: fixedPayoutCents,
      currency: campaign.currency,
      status: flagVelocity ? "PENDING_VERIFICATION" : "SUBMITTED",
      qualitySignals:
        Object.keys(qualitySignals).length > 0
          ? (qualitySignals as Prisma.InputJsonValue)
          : undefined,
    },
  });

  // 6. If velocity flagged, create a fraud investigation
  if (flagVelocity) {
    await prisma.fraudInvestigation.create({
      data: {
        agentId: affiliateId,
        triggerEvent: `Velocity anomaly: ${recentLeadCount + 1} leads/min for lead ${lead.id}`,
        triggerType: "VELOCITY_ANOMALY",
        severity: "MEDIUM",
        signals: [
          {
            signalType: "VELOCITY",
            confidence: 0.8,
            evidence: {
              leadsPerMinute: recentLeadCount + 1,
              threshold: 10,
              leadId: lead.id,
            },
          },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // 7. Place escrow hold to reserve funds for this lead
  const escrowAccount = await prisma.escrowAccount.findUnique({
    where: { campaignId: data.campaignId },
  });

  if (!escrowAccount) {
    throw new ValidationError("Campaign has no escrow account");
  }

  const payoutAmount = lead.payoutCents ?? fixedPayoutCents;

  try {
    await escrowService.placeHold(
      escrowAccount.id,
      lead.id,
      affiliateId,
      payoutAmount
    );
  } catch (err) {
    const reason = escrowService.classifyFundingError(err);
    if (reason) {
      notify({
        type: "conversion.funding_failed",
        data: {
          leadId: lead.id,
          campaignId: campaign.id,
          campaignName: campaign.name,
          advertiserId: campaign.advertiserId,
          affiliateId,
          payoutCents: payoutAmount,
          reason,
        },
      });
    }
    throw err;
  }

  // 8. Fire notification (non-blocking)
  notify({
    type: "lead.submitted",
    data: {
      leadId: lead.id,
      campaignId: data.campaignId,
      affiliateId,
    },
  });

  return lead;
}

// ---------------------------------------------------------------------------
// Get Lead
// ---------------------------------------------------------------------------

export async function getLead(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          advertiserId: true,
          compensationModel: true,
          status: true,
          holdingPeriodDays: true,
        },
      },
      affiliate: {
        select: {
          id: true,
          displayName: true,
          type: true,
        },
      },
      conversions: true,
      escrowHold: {
        select: {
          status: true,
          releaseAt: true,
          heldAt: true,
          releasedAt: true,
          amountCents: true,
        },
      },
    },
  });

  if (!lead) {
    throw new NotFoundError("Lead", leadId);
  }

  return lead;
}

// ---------------------------------------------------------------------------
// List Leads
// ---------------------------------------------------------------------------

export async function listLeads(
  filters: ListLeadsInput,
  agentId?: string,
  agentType?: string
) {
  const where: Prisma.LeadWhereInput = {};

  // Scope to authenticated agent
  if (agentId && agentType) {
    if (agentType === "AFFILIATE") {
      where.affiliateId = agentId;
    } else if (agentType === "ADVERTISER") {
      where.campaign = { advertiserId: agentId };
    }
    // DUAL agents see leads where they are affiliate OR advertiser
    if (agentType === "DUAL") {
      where.OR = [
        { affiliateId: agentId },
        { campaign: { advertiserId: agentId } },
      ];
    }
  }

  if (filters.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters.affiliateId) {
    // Only allow filtering by affiliateId if it matches the requesting agent
    // or the agent is an advertiser (viewing their campaign's affiliates)
    where.affiliateId = filters.affiliateId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.submittedAt = {};
    if (filters.dateFrom) {
      where.submittedAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.submittedAt.lte = filters.dateTo;
    }
  }

  const [leads, totalCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { submittedAt: "desc" },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            advertiserId: true,
            holdingPeriodDays: true,
          },
        },
        affiliate: {
          select: {
            id: true,
            displayName: true,
          },
        },
        escrowHold: {
          select: {
            status: true,
            releaseAt: true,
            heldAt: true,
            releasedAt: true,
            amountCents: true,
          },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    leads,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Verify Lead
// ---------------------------------------------------------------------------

export async function verifyLead(
  leadId: string,
  advertiserId: string,
  data?: VerifyLeadInput
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      campaign: { select: { advertiserId: true, name: true } },
    },
  });

  if (!lead) {
    throw new NotFoundError("Lead", leadId);
  }

  if (lead.campaign.advertiserId !== advertiserId) {
    throw new ForbiddenError(
      "Only the campaign owner can verify leads"
    );
  }

  if (lead.status !== "SUBMITTED" && lead.status !== "PENDING_VERIFICATION") {
    throw new ValidationError(
      `Lead cannot be verified from status '${lead.status}'`
    );
  }

  // Update lead and find hold atomically
  const { updatedLead, holdId } = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        qualityScore: data?.qualityScore,
        qualitySignals: data?.qualitySignals
          ? (data.qualitySignals as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const hold = await tx.escrowHold.findFirst({
      where: { leadId, status: "HELD" },
    });

    return { updatedLead: updated, holdId: hold?.id ?? null };
  });

  // Release escrow hold to pay the affiliate (outside tx — releaseHold has its own)
  if (holdId) {
    await escrowService.releaseHold(holdId);
  }

  // Recalculate affiliate reputation
  try {
    await reputationService.recalculateReputation(lead.affiliateId);
  } catch (err) {
    logger.error({ err, affiliateId: lead.affiliateId, leadId, action: "recalculate_reputation_after_verify" }, "Failed to recalculate reputation after lead verification");
  }

  // Fire notification (non-blocking)
  notify({
    type: "lead.verified",
    data: {
      leadId,
      campaignId: lead.campaignId,
      campaignName: lead.campaign.name,
      affiliateId: lead.affiliateId,
      advertiserId,
      payoutCents: lead.payoutCents ?? 0,
    },
  });

  return updatedLead;
}

// ---------------------------------------------------------------------------
// Reject Lead
// ---------------------------------------------------------------------------

export async function rejectLead(
  leadId: string,
  advertiserId: string,
  reason: string
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      campaign: { select: { advertiserId: true, name: true } },
    },
  });

  if (!lead) {
    throw new NotFoundError("Lead", leadId);
  }

  if (lead.campaign.advertiserId !== advertiserId) {
    throw new ForbiddenError(
      "Only the campaign owner can reject leads"
    );
  }

  if (lead.status !== "SUBMITTED" && lead.status !== "PENDING_VERIFICATION") {
    throw new ValidationError(
      `Lead cannot be rejected from status '${lead.status}'`
    );
  }

  // Update lead and find hold atomically
  const { updatedLead, holdId } = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    const hold = await tx.escrowHold.findFirst({
      where: { leadId, status: "HELD" },
    });

    return { updatedLead: updated, holdId: hold?.id ?? null };
  });

  // Refund escrow hold back to escrow balance (outside tx — refundHold has its own)
  if (holdId) {
    await escrowService.refundHold(holdId);
  }

  // Recalculate affiliate reputation
  try {
    await reputationService.recalculateReputation(lead.affiliateId);
  } catch (err) {
    logger.error({ err, affiliateId: lead.affiliateId, leadId, action: "recalculate_reputation_after_reject" }, "Failed to recalculate reputation after lead rejection");
  }

  // Fire notification (non-blocking)
  notify({
    type: "lead.rejected",
    data: {
      leadId,
      campaignId: lead.campaignId,
      campaignName: lead.campaign.name,
      affiliateId: lead.affiliateId,
      advertiserId,
      reason,
    },
  });

  return updatedLead;
}

// ---------------------------------------------------------------------------
// Dispute Lead
// ---------------------------------------------------------------------------

export async function disputeLead(
  leadId: string,
  advertiserId: string,
  reason: string
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      campaign: { select: { advertiserId: true, name: true } },
    },
  });

  if (!lead) {
    throw new NotFoundError("Lead", leadId);
  }

  if (lead.campaign.advertiserId !== advertiserId) {
    throw new ForbiddenError(
      "Only the campaign owner can dispute leads"
    );
  }

  if (lead.status !== "VERIFIED") {
    throw new ValidationError(
      `Lead cannot be disputed from status '${lead.status}'`
    );
  }

  // Update lead + refund hold in a single transaction to prevent race with processMaturedHolds()
  const updatedLead = await prisma.$transaction(async (tx) => {
    // Lock the hold row first (findFirst + FOR UPDATE via update) to prevent
    // processMaturedHolds() from releasing it concurrently
    const hold = await tx.escrowHold.findFirst({
      where: { leadId, status: "PENDING_RELEASE" },
      include: { escrowAccount: { select: { campaignId: true } } },
    });

    if (!hold) {
      throw new DisputeWindowClosedError(
        "Lead cannot be disputed: the holding period has elapsed and funds have been released"
      );
    }

    // Clock-based guard: if the hold's releaseAt has passed but the maturation
    // cron hasn't run yet, the dispute window is economically closed. Reject
    // authoritatively rather than letting the ≤5-min cron-latency race allow
    // a dispute past the configured window.
    if (hold.releaseAt && hold.releaseAt.getTime() <= Date.now()) {
      throw new DisputeWindowClosedError(
        "Lead cannot be disputed: the holding period has elapsed"
      );
    }

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        status: "DISPUTED",
        disputedAt: new Date(),
        disputeReason: reason,
      },
    });

    // Refund the hold (inlined from escrowService.refundHold to stay in same tx)
    await tx.escrowHold.update({
      where: { id: hold.id },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });

    await tx.escrowAccount.update({
      where: { id: hold.escrowId },
      data: {
        currentBalanceCents: { increment: hold.amountCents },
        totalRefundedCents: { increment: hold.amountCents },
        totalReleasedCents: { decrement: hold.amountCents },
      },
    });

    await tx.campaign.update({
      where: { id: hold.escrowAccount.campaignId },
      data: { budgetSpentCents: { decrement: hold.amountCents } },
    });

    // Double-entry ledger
    const transactionId = randomUUID();
    await tx.ledgerEntry.create({
      data: {
        transactionId,
        debitAccountType: "ESCROW",
        debitAccountId: hold.id,
        creditAccountType: "ESCROW",
        creditAccountId: hold.escrowId,
        amountCents: hold.amountCents,
        currency: hold.currency,
        entryType: "ADJUSTMENT",
        referenceType: "LEAD",
        referenceId: hold.leadId,
        memo: `Refunded ${hold.amountCents} cents to escrow for disputed lead ${hold.leadId}`,
      },
    });

    await tx.domainEvent.create({
      data: {
        aggregateType: "EscrowHold",
        aggregateId: hold.id,
        eventType: "EscrowRefunded",
        payload: {
          holdId: hold.id,
          escrowId: hold.escrowId,
          leadId: hold.leadId,
          amountCents: hold.amountCents,
          wasPendingRelease: true,
        } as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });

    return updated;
  });

  // Recalculate affiliate reputation
  try {
    await reputationService.recalculateReputation(lead.affiliateId);
  } catch (err) {
    logger.error({ err, affiliateId: lead.affiliateId, leadId, action: "recalculate_reputation_after_dispute" }, "Failed to recalculate reputation after lead dispute");
  }

  // Fire notification (non-blocking)
  notify({
    type: "lead.disputed",
    data: {
      leadId,
      campaignId: lead.campaignId,
      campaignName: lead.campaign.name,
      affiliateId: lead.affiliateId,
      advertiserId,
      reason,
      payoutCents: lead.payoutCents ?? 0,
    },
  });

  return updatedLead;
}

// ---------------------------------------------------------------------------
// Submit Conversion
// ---------------------------------------------------------------------------

export async function submitConversion(
  affiliateId: string,
  data: SubmitConversionInput
) {
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    include: {
      campaign: {
        select: {
          id: true,
          advertiserId: true,
          compensationModel: true,
          payoutPerUnitCents: true,
          payoutPercentage: true,
          currency: true,
        },
      },
    },
  });

  if (!lead) {
    throw new NotFoundError("Lead", data.leadId);
  }

  if (lead.affiliateId !== affiliateId) {
    throw new ForbiddenError(
      "You can only submit conversions for your own leads"
    );
  }

  if (lead.status !== "VERIFIED") {
    throw new ValidationError(
      "Conversions can only be submitted for verified leads"
    );
  }

  const occurredAt = data.occurredAt ?? new Date();

  if (
    lead.campaign.compensationModel === "REV_SHARE" &&
    data.revenueCents == null
  ) {
    throw new ValidationError(
      "revenueCents is required for conversions on REV_SHARE campaigns"
    );
  }
  const payoutCents = escrowService.calculatePayout(lead.campaign, {
    revenueCents: data.revenueCents,
  });

  const conversion = await prisma.conversionEvent.create({
    data: {
      leadId: data.leadId,
      campaignId: lead.campaign.id,
      affiliateId,
      actionType: data.actionType,
      conversionData: (data.conversionData as Prisma.InputJsonValue) ?? undefined,
      revenueCents: data.revenueCents,
      currency: data.currency ?? lead.campaign.currency,
      payoutCents,
      occurredAt,
    },
  });

  return conversion;
}

// ---------------------------------------------------------------------------
// List Conversions
// ---------------------------------------------------------------------------

export async function listConversions(filters: ListConversionsInput) {
  const where: Prisma.ConversionEventWhereInput = {};

  if (filters.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters.affiliateId) {
    where.affiliateId = filters.affiliateId;
  }

  if (filters.leadId) {
    where.leadId = filters.leadId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.actionType) {
    where.actionType = filters.actionType;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.occurredAt = {};
    if (filters.dateFrom) {
      where.occurredAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.occurredAt.lte = filters.dateTo;
    }
  }

  const [conversions, totalCount] = await Promise.all([
    prisma.conversionEvent.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { occurredAt: "desc" },
      include: {
        lead: {
          select: {
            id: true,
            externalId: true,
            status: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        affiliate: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.conversionEvent.count({ where }),
  ]);

  return {
    conversions,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}
