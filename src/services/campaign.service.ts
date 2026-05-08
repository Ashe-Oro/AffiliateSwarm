import { prisma } from "@/lib/prisma";
import {
  generateTrackingCode,
  generateRefSeed,
  deriveTrackingCode,
  withUniqueCodeRetry,
} from "@/lib/tracking-code";
import { buildTrackingUrl } from "@/lib/tracking-url";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors";
import { notify } from "@/services/notification.service";
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  ListCampaignsInput,
  DiscoverCampaignsInput,
  ApplyToCampaignInput,
  ReviewApplicationInput,
} from "@/lib/validators/campaign";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

export async function createCampaign(
  advertiserId: string,
  data: CreateCampaignInput
) {
  // Belt-and-suspenders: verify the agent is actually an advertiser
  const agent = await prisma.agent.findFirst({
    where: { id: advertiserId, deletedAt: null },
  });
  if (!agent || (agent.type !== "ADVERTISER" && agent.type !== "DUAL")) {
    throw new ForbiddenError("Only advertiser agents can create campaigns");
  }

  const result = await withUniqueCodeRetry(() => prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        advertiserId,
        testTrackingCode: generateTrackingCode(),
        refSeed: generateRefSeed(),
        name: data.name,
        description: data.description,
        compensationModel: data.compensationModel,
        payoutPerUnitCents: data.payoutPerUnitCents ?? null,
        payoutPercentage: data.payoutPercentage ?? null,
        currency: data.currency,
        budgetCents: data.budgetCents,
        dailyCapCount: data.dailyCapCount ?? null,
        dailyCapCents: data.dailyCapCents ?? null,
        geoTargets: data.geoTargets ?? [],
        categories: data.categories ?? [],
        landingUrl: data.landingUrl,
        productUrl: data.productUrl,
        conversionAction: data.conversionAction,
        productDescription: data.productDescription,
        brandAssets: (data.brandAssets as Prisma.InputJsonValue) ?? undefined,
        buyerIncentiveType: data.buyerIncentiveType,
        buyerIncentiveValue: data.buyerIncentiveValue,
        buyerIncentiveLabel: data.buyerIncentiveLabel,
        buyerCouponCode: data.buyerCouponCode,
        holdingPeriodDays: data.holdingPeriodDays,
        enrollmentPolicy: data.enrollmentPolicy,
        requiresVerification: data.requiresVerification,
        leadRequirements: (data.leadRequirements as Prisma.InputJsonValue) ?? undefined,
        targetingCriteria: (data.targetingCriteria as Prisma.InputJsonValue) ?? undefined,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      },
    });

    const escrowAccount = await tx.escrowAccount.create({
      data: {
        campaignId: campaign.id,
        advertiserId,
        currency: data.currency,
      },
    });

    return { campaign, escrowAccount };
  }));

  notify({
    type: "campaign.created",
    data: {
      campaignId: result.campaign.id,
      campaignName: result.campaign.name,
      advertiserId,
    },
  });

  return result;
}

export async function getCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    include: {
      escrowAccount: true,
      advertiser: {
        select: {
          id: true,
          displayName: true,
          type: true,
          status: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  return campaign;
}

export async function updateCampaign(
  campaignId: string,
  requestingAgentId: string,
  data: UpdateCampaignInput
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.advertiserId !== requestingAgentId) {
    throw new ForbiddenError("You can only update your own campaigns");
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
    throw new ValidationError(
      "Campaign can only be updated when in DRAFT or PAUSED status"
    );
  }

  // Enforce payout-field XOR: REV_SHARE campaigns own payoutPercentage only,
  // fixed-payout campaigns own payoutPerUnitCents only. Reject attempts to
  // set the wrong field rather than silently corrupting the invariant.
  if (
    campaign.compensationModel === "REV_SHARE" &&
    data.payoutPerUnitCents != null
  ) {
    throw new ValidationError(
      "Cannot set payoutPerUnitCents on a REV_SHARE campaign; use payoutPercentage"
    );
  }
  if (
    campaign.compensationModel !== "REV_SHARE" &&
    data.payoutPercentage != null
  ) {
    throw new ValidationError(
      `Cannot set payoutPercentage on a ${campaign.compensationModel} campaign; use payoutPerUnitCents`
    );
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name: data.name,
      description: data.description,
      payoutPerUnitCents: data.payoutPerUnitCents,
      payoutPercentage: data.payoutPercentage,
      budgetCents: data.budgetCents,
      dailyCapCount: data.dailyCapCount,
      dailyCapCents: data.dailyCapCents,
      geoTargets: data.geoTargets,
      categories: data.categories,
      landingUrl: data.landingUrl,
      productUrl: data.productUrl,
      conversionAction: data.conversionAction,
      productDescription: data.productDescription,
      brandAssets: data.brandAssets as Prisma.InputJsonValue | undefined,
      buyerIncentiveType: data.buyerIncentiveType,
      buyerIncentiveValue: data.buyerIncentiveValue,
      buyerIncentiveLabel: data.buyerIncentiveLabel,
      buyerCouponCode: data.buyerCouponCode,
      holdingPeriodDays: data.holdingPeriodDays,
      enrollmentPolicy: data.enrollmentPolicy,
      requiresVerification: data.requiresVerification,
      leadRequirements: data.leadRequirements as Prisma.InputJsonValue | undefined,
      targetingCriteria: data.targetingCriteria as Prisma.InputJsonValue | undefined,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    },
  });
}

export async function activateCampaign(
  campaignId: string,
  requestingAgentId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    include: { escrowAccount: true },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.advertiserId !== requestingAgentId) {
    throw new ForbiddenError("You can only activate your own campaigns");
  }

  if (campaign.status !== "DRAFT") {
    throw new ValidationError("Only draft campaigns can be activated");
  }

  if (!campaign.escrowAccount) {
    throw new NotFoundError("EscrowAccount for campaign", campaignId);
  }

  // Campaigns auto-fund from the advertiser's wallet at conversion time up to
  // budgetCents. Require the advertiser have *some* wallet balance so an
  // activated campaign can actually pay out at least one conversion.
  const advertiserWallet = await prisma.wallet.findUnique({
    where: { agentId: campaign.advertiserId },
  });
  const availableForCampaign =
    (advertiserWallet?.availableCents ?? 0) +
    campaign.escrowAccount.currentBalanceCents;
  if (availableForCampaign <= 0) {
    throw new ValidationError(
      "Fund your wallet before activating this campaign. Campaigns draw from wallet balance as conversions come in."
    );
  }

  if (!campaign.trackingConfirmedAt) {
    throw new ValidationError(
      "You must confirm tracking setup before activating this campaign. Use the 'Confirm Tracking' endpoint or button to verify your postback/conversion tracking is configured."
    );
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "ACTIVE" },
  });

  notify({
    type: "campaign.activated",
    data: { campaignId, campaignName: campaign.name, advertiserId: campaign.advertiserId },
  });

  // Soft oversubscription signal: after activation, if the sum of remaining
  // budgets across this advertiser's active campaigns exceeds their wallet
  // balance, warn them. Campaigns still activate — this is informational.
  const coverage = await computeAdvertiserBudgetCoverage(campaign.advertiserId);
  if (coverage.oversubscribed) {
    notify({
      type: "campaign.oversubscribed",
      data: {
        advertiserId: campaign.advertiserId,
        activeBudgetHeadroomCents: coverage.activeBudgetHeadroomCents,
        walletAvailableCents: coverage.walletAvailableCents,
        shortfallCents: coverage.shortfallCents,
        activeCampaignCount: coverage.activeCampaignCount,
      },
    });
  }

  return updated;
}

/**
 * Computes how much wallet runway the advertiser has relative to their
 * combined remaining budget across active campaigns. Used to flag
 * oversubscription (budgets exceed wallet — campaigns may starve each other
 * under the wallet-first funding model).
 */
export async function computeAdvertiserBudgetCoverage(advertiserId: string) {
  const [activeCampaigns, wallet] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        advertiserId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        budgetCents: true,
        escrowAccount: { select: { totalDepositedCents: true } },
      },
    }),
    prisma.wallet.findUnique({ where: { agentId: advertiserId } }),
  ]);

  const activeBudgetHeadroomCents = activeCampaigns.reduce((sum, c) => {
    const deposited = c.escrowAccount?.totalDepositedCents ?? 0;
    return sum + Math.max(0, c.budgetCents - deposited);
  }, 0);

  const walletAvailableCents = wallet?.availableCents ?? 0;
  const shortfallCents = Math.max(0, activeBudgetHeadroomCents - walletAvailableCents);

  return {
    activeCampaignCount: activeCampaigns.length,
    activeBudgetHeadroomCents,
    walletAvailableCents,
    shortfallCents,
    oversubscribed: shortfallCents > 0,
  };
}

export async function pauseCampaign(
  campaignId: string,
  requestingAgentId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.advertiserId !== requestingAgentId) {
    throw new ForbiddenError("You can only pause your own campaigns");
  }

  if (campaign.status !== "ACTIVE") {
    throw new ValidationError("Only active campaigns can be paused");
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });

  notify({
    type: "campaign.paused",
    data: { campaignId, campaignName: campaign.name, advertiserId: campaign.advertiserId },
  });

  return updated;
}

export async function resumeCampaign(
  campaignId: string,
  requestingAgentId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.advertiserId !== requestingAgentId) {
    throw new ForbiddenError("You can only resume your own campaigns");
  }

  if (campaign.status !== "PAUSED") {
    throw new ValidationError("Only paused campaigns can be resumed");
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "ACTIVE" },
  });

  notify({
    type: "campaign.resumed",
    data: { campaignId, campaignName: campaign.name, advertiserId: campaign.advertiserId },
  });

  // Same oversubscription check as activateCampaign — resuming a paused
  // campaign that now has a larger budget (the common "pause, raise budget,
  // resume" flow) can tip the advertiser's active-budget headroom past their
  // wallet balance without ever going through activateCampaign. The 60-sec
  // dedup on `${advertiserId}:oversubscribed` prevents spam if multiple
  // campaigns are resumed in quick succession. See issue #216.
  const coverage = await computeAdvertiserBudgetCoverage(campaign.advertiserId);
  if (coverage.oversubscribed) {
    notify({
      type: "campaign.oversubscribed",
      data: {
        advertiserId: campaign.advertiserId,
        activeBudgetHeadroomCents: coverage.activeBudgetHeadroomCents,
        walletAvailableCents: coverage.walletAvailableCents,
        shortfallCents: coverage.shortfallCents,
        activeCampaignCount: coverage.activeCampaignCount,
      },
    });
  }

  return updated;
}

export async function deleteCampaign(
  campaignId: string,
  requestingAgentId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.advertiserId !== requestingAgentId) {
    throw new ForbiddenError("You can only delete your own campaigns");
  }

  if (campaign.status !== "DRAFT") {
    throw new ValidationError("Only draft campaigns can be deleted");
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  });
}

export async function listCampaigns(
  advertiserId: string,
  filters: ListCampaignsInput
) {
  const where: Prisma.CampaignWhereInput = {
    advertiserId,
    deletedAt: null,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.compensationModel) {
    where.compensationModel = filters.compensationModel;
  }

  if (filters.category) {
    where.categories = { has: filters.category };
  }

  const [campaigns, totalCount] = await Promise.all([
    prisma.campaign.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        escrowAccount: {
          select: {
            id: true,
            currentBalanceCents: true,
            status: true,
          },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    campaigns,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function discoverCampaigns(filters: DiscoverCampaignsInput) {
  const where: Prisma.CampaignWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
  };

  if (filters.compensationModel) {
    where.compensationModel = filters.compensationModel;
  }

  if (filters.category) {
    where.categories = { has: filters.category };
  }

  if (filters.geo) {
    where.geoTargets = { has: filters.geo };
  }

  if (filters.query) {
    where.name = { contains: filters.query, mode: "insensitive" };
  }

  const [campaigns, totalCount] = await Promise.all([
    prisma.campaign.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        compensationModel: true,
        payoutPerUnitCents: true,
        payoutPercentage: true,
        currency: true,
        geoTargets: true,
        categories: true,
        landingUrl: true,
        productUrl: true,
        conversionAction: true,
        productDescription: true,
        brandAssets: true,
        buyerIncentiveType: true,
        buyerIncentiveValue: true,
        buyerIncentiveLabel: true,
        buyerCouponCode: true,
        enrollmentPolicy: true,
        requiresVerification: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        advertiser: {
          select: {
            id: true,
            displayName: true,
            logoUrl: true,
          },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    campaigns,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Enrollment / Applications
// ---------------------------------------------------------------------------

export async function applyToCampaign(
  campaignId: string,
  affiliateId: string,
  data: ApplyToCampaignInput
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.status !== "ACTIVE") {
    throw new ValidationError("Can only apply to active campaigns");
  }

  if (campaign.advertiserId === affiliateId) {
    throw new ValidationError("Cannot apply to your own campaign");
  }

  // Check for existing enrollment
  const existing = await prisma.affiliateEnrollment.findUnique({
    where: {
      campaignId_affiliateId: { campaignId, affiliateId },
    },
  });

  if (existing) {
    throw new ConflictError(
      "You have already applied to this campaign"
    );
  }

  const status =
    campaign.enrollmentPolicy === "OPEN" ? "APPROVED" : "PENDING";

  const affiliate = await prisma.agent.findUnique({
    where: { id: affiliateId },
    select: { displayName: true },
  });

  const trackingCode =
    status === "APPROVED" && campaign.refSeed
      ? deriveTrackingCode(campaign.refSeed, affiliateId)
      : status === "APPROVED"
        ? generateTrackingCode() // fallback for old campaigns without a refSeed
        : null;

  const enrollment = await withUniqueCodeRetry(() =>
    prisma.affiliateEnrollment.create({
      data: {
        campaignId,
        affiliateId,
        status,
        pitch: data.pitch,
        customTerms: (data.customTerms as Prisma.InputJsonValue) ?? undefined,
        trackingCode,
        approvedAt: status === "APPROVED" ? new Date() : null,
      },
    })
  );

  const affiliateName = affiliate?.displayName ?? "Unknown";

  if (status === "APPROVED") {
    notify({
      type: "application.approved",
      data: {
        campaignId,
        affiliateId,
        enrollmentId: enrollment.id,
        campaignName: campaign.name,
        affiliateName,
        trackingCode: enrollment.trackingCode ?? undefined,
        trackingUrl:
          (enrollment.trackingCode &&
            buildTrackingUrl(campaign.landingUrl, enrollment.trackingCode, campaign.buyerCouponCode)) ||
          undefined,
      },
    });
  } else {
    notify({
      type: "application.submitted",
      data: {
        campaignId,
        affiliateId,
        enrollmentId: enrollment.id,
        campaignName: campaign.name,
        affiliateName,
      },
    });
  }

  return enrollment;
}

export async function listApplications(
  campaignId: string,
  requestingAgentId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.advertiserId !== requestingAgentId) {
    throw new ForbiddenError(
      "You can only view applications for your own campaigns"
    );
  }

  return prisma.affiliateEnrollment.findMany({
    where: { campaignId },
    include: {
      affiliate: {
        select: {
          id: true,
          displayName: true,
          description: true,
          type: true,
          status: true,
          logoUrl: true,
          websiteUrl: true,
          audienceSize: true,
          channels: true,
          contentType: true,
          relevantUrls: true,
          audienceGeo: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAffiliateApplications(
  affiliateId: string,
  status?: string
) {
  const where: Prisma.AffiliateEnrollmentWhereInput = { affiliateId };
  if (status) {
    where.status = status as Prisma.AffiliateEnrollmentWhereInput["status"];
  }

  return prisma.affiliateEnrollment.findMany({
    where,
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          landingUrl: true,
          buyerCouponCode: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewApplication(
  campaignId: string,
  applicationId: string,
  requestingAgentId: string,
  data: ReviewApplicationInput
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  if (campaign.advertiserId !== requestingAgentId) {
    throw new ForbiddenError(
      "You can only review applications for your own campaigns"
    );
  }

  const enrollment = await prisma.affiliateEnrollment.findFirst({
    where: { id: applicationId, campaignId },
  });

  if (!enrollment) {
    throw new NotFoundError("Application", applicationId);
  }

  if (enrollment.status !== "PENDING") {
    throw new ValidationError("Only pending applications can be reviewed");
  }

  const updateData: Prisma.AffiliateEnrollmentUpdateInput = {
    status: data.decision,
  };

  if (data.decision === "APPROVED") {
    updateData.approvedAt = new Date();
  } else {
    updateData.rejectedAt = new Date();
    updateData.revokeReason = data.revokeReason;
  }

  const updatedEnrollment = await withUniqueCodeRetry(() => {
    if (data.decision === "APPROVED") {
      updateData.trackingCode = campaign.refSeed
        ? deriveTrackingCode(campaign.refSeed, enrollment.affiliateId)
        : generateTrackingCode();
    }
    return prisma.affiliateEnrollment.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        affiliate: {
          select: {
            id: true,
            displayName: true,
            type: true,
          },
        },
      },
    });
  });

  if (data.decision === "APPROVED") {
    notify({
      type: "application.approved",
      data: {
        campaignId,
        affiliateId: enrollment.affiliateId,
        enrollmentId: applicationId,
        campaignName: campaign.name,
        affiliateName: updatedEnrollment.affiliate.displayName,
        trackingCode: updatedEnrollment.trackingCode ?? undefined,
        trackingUrl:
          (updatedEnrollment.trackingCode &&
            buildTrackingUrl(campaign.landingUrl, updatedEnrollment.trackingCode, campaign.buyerCouponCode)) ||
          undefined,
      },
    });
  } else {
    notify({
      type: "application.rejected",
      data: {
        campaignId,
        affiliateId: enrollment.affiliateId,
        enrollmentId: applicationId,
        campaignName: campaign.name,
        affiliateName: updatedEnrollment.affiliate.displayName,
        reason: data.revokeReason,
      },
    });
  }

  return updatedEnrollment;
}
