import { createHash, createHmac, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import * as escrowService from "@/services/escrow.service";
import * as reputationService from "@/services/reputation.service";
import { notify } from "@/services/notification.service";
import type { PostbackInput, CreateReferralInput, ConfirmReferralInput } from "@/lib/validators/tracking";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

const REFERRAL_SECRET =
  process.env.AFFILIATESWARM_REFERRAL_SECRET || "affiliateswarm-dev-secret";

function syntheticTestLeadId(campaignId: string, externalId: string): string {
  const digest = createHash("sha256")
    .update(`${campaignId}:${externalId}`)
    .digest("hex");

  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `a${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

// ---------------------------------------------------------------------------
// Track Click
// ---------------------------------------------------------------------------

export type TrackClickResult =
  | { success: true; redirectUrl: string; trackingCode: string; campaignId: string; affiliateId: string }
  | { success: false; error: 'ENROLLMENT_NOT_FOUND' | 'NOT_APPROVED' | 'CAMPAIGN_INACTIVE' };

export async function trackClick(
  trackingCode: string,
  requestInfo: {
    ipAddress?: string;
    userAgent?: string;
    referer?: string;
    geo?: string;
  }
): Promise<TrackClickResult> {
  const enrollment = await prisma.affiliateEnrollment.findUnique({
    where: { trackingCode },
    include: {
      campaign: {
        select: {
          id: true,
          status: true,
          landingUrl: true,
        },
      },
    },
  });

  if (!enrollment) return { success: false, error: 'ENROLLMENT_NOT_FOUND' };
  if (enrollment.status !== "APPROVED") return { success: false, error: 'NOT_APPROVED' };
  if (enrollment.campaign.status !== "ACTIVE" || !enrollment.campaign.landingUrl) return { success: false, error: 'CAMPAIGN_INACTIVE' };

  // Fire-and-forget: insert click event
  prisma.clickEvent
    .create({
      data: {
        trackingCode,
        campaignId: enrollment.campaignId,
        affiliateId: enrollment.affiliateId,
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        referer: requestInfo.referer,
        geo: requestInfo.geo,
      },
    })
    .catch((err) => logger.error({ err, trackingCode, campaignId: enrollment.campaignId, affiliateId: enrollment.affiliateId, action: "insert_click_event" }, "Failed to insert click event"));

  // Fire-and-forget: notification
  notify({
    type: "click.tracked",
    data: {
      trackingCode,
      campaignId: enrollment.campaignId,
      affiliateId: enrollment.affiliateId,
    },
  });

  return {
    success: true,
    redirectUrl: enrollment.campaign.landingUrl,
    trackingCode,
    campaignId: enrollment.campaignId,
    affiliateId: enrollment.affiliateId,
  };
}

// ---------------------------------------------------------------------------
// Process Postback
// ---------------------------------------------------------------------------

export async function processPostback(
  advertiserId: string,
  data: PostbackInput
) {
  const trackingCode = data.swarm_ref;

  // CONFIRM postback path: advertiser fires a test postback with the
  // campaign's testTrackingCode to prove their integration is wired. We
  // don't create a lead, don't require the campaign to be ACTIVE (this
  // is the gate to *becoming* ACTIVE), and flip trackingConfirmedAt.
  const testMatch = await prisma.campaign.findUnique({
    where: { testTrackingCode: trackingCode },
    select: {
      id: true,
      advertiserId: true,
      name: true,
      trackingConfirmedAt: true,
    },
  });

  if (testMatch) {
    if (testMatch.advertiserId !== advertiserId) {
      throw new ForbiddenError("This tracking code does not belong to your campaign");
    }

    let confirmedAt = testMatch.trackingConfirmedAt;
    if (!confirmedAt) {
      confirmedAt = new Date();
      await prisma.campaign.update({
        where: { id: testMatch.id },
        data: { trackingConfirmedAt: confirmedAt },
      });
      notify({
        type: "campaign.tracking_confirmed",
        data: {
          campaignId: testMatch.id,
          campaignName: testMatch.name,
          advertiserId,
        },
      });
    }

    const leadId = syntheticTestLeadId(testMatch.id, data.externalId);

    return {
      test: true as const,
      id: leadId,
      leadId,
      created: false,
      campaignId: testMatch.id,
      externalId: data.externalId,
      trackingConfirmedAt: confirmedAt,
      message:
        "Test postback received — tracking confirmed. You can now activate this campaign.",
    };
  }

  // Look up enrollment by tracking code
  const enrollment = await prisma.affiliateEnrollment.findUnique({
    where: { trackingCode },
    include: {
      campaign: true,
    },
  });

  if (!enrollment) {
    throw new NotFoundError("No affiliate enrollment for tracking code", trackingCode);
  }

  if (enrollment.campaign.advertiserId !== advertiserId) {
    throw new ForbiddenError("This tracking code does not belong to your campaign");
  }

  if (enrollment.campaign.status !== "ACTIVE") {
    throw new ValidationError("Campaign is not active");
  }

  // Idempotency: check existing lead with same externalId + campaignId
  const existing = await prisma.lead.findFirst({
    where: {
      externalId: data.externalId,
      campaignId: enrollment.campaignId,
    },
  });

  if (existing) {
    return { lead: existing, created: false };
  }

  // Compute payout. REV_SHARE campaigns require revenueCents on the postback;
  // we validate here rather than at the schema level because the requirement
  // depends on the referenced campaign's compensation model.
  if (
    enrollment.campaign.compensationModel === "REV_SHARE" &&
    data.revenueCents == null
  ) {
    throw new ValidationError(
      "revenueCents is required on postbacks for REV_SHARE campaigns"
    );
  }
  const payoutCents = escrowService.calculatePayout(enrollment.campaign, {
    revenueCents: data.revenueCents,
  });

  // Get escrow account
  const escrowAccount = await prisma.escrowAccount.findUnique({
    where: { campaignId: enrollment.campaignId },
  });

  if (!escrowAccount) {
    throw new ValidationError("Campaign has no escrow account");
  }

  // Create lead as VERIFIED (postbacks are server-to-server, trusted).
  //
  // The @@unique([campaignId, externalId]) constraint is the authoritative
  // dedup guard: the findFirst check above is racy (two concurrent postbacks
  // for the same externalId both see "no existing"), so we rely on the DB to
  // reject the second insert. On a P2002 we return the row the winner created
  // WITHOUT placing/releasing a second escrow hold — that is what prevents the
  // double payout.
  let lead;
  try {
    lead = await prisma.lead.create({
      data: {
        campaignId: enrollment.campaignId,
        affiliateId: enrollment.affiliateId,
        externalId: data.externalId,
        trackingCode,
        status: "VERIFIED",
        verifiedAt: new Date(),
        payoutCents,
        currency: enrollment.campaign.currency,
        leadData: (data.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      (err as { code?: string }).code === "P2002"
    ) {
      const existingLead = await prisma.lead.findFirst({
        where: {
          externalId: data.externalId,
          campaignId: enrollment.campaignId,
        },
      });
      if (existingLead) {
        return { lead: existingLead, created: false };
      }
    }
    throw err;
  }

  // Place escrow hold and immediately release. If the wallet or campaign
  // budget can't cover it, notify both sides so the affiliate can pause
  // traffic and the advertiser knows to top up.
  let hold;
  try {
    hold = await escrowService.placeHold(
      escrowAccount.id,
      lead.id,
      enrollment.affiliateId,
      payoutCents
    );
  } catch (err) {
    const reason = escrowService.classifyFundingError(err);
    if (reason) {
      notify({
        type: "conversion.funding_failed",
        data: {
          leadId: lead.id,
          campaignId: enrollment.campaignId,
          campaignName: enrollment.campaign.name,
          advertiserId: enrollment.campaign.advertiserId,
          affiliateId: enrollment.affiliateId,
          payoutCents,
          reason,
        },
      });
    }
    throw err;
  }
  await escrowService.releaseHold(hold.id);

  // Create ConversionEvent record so conversions dashboard is populated
  await prisma.conversionEvent.create({
    data: {
      leadId: lead.id,
      campaignId: enrollment.campaignId,
      affiliateId: enrollment.affiliateId,
      actionType: data.eventType as "PURCHASE" | "SIGNUP" | "INSTALL" | "SUBSCRIPTION" | "CUSTOM",
      revenueCents: data.revenueCents ?? 0,
      currency: enrollment.campaign.currency,
      payoutCents,
      status: "VERIFIED",
      verifiedAt: new Date(),
      conversionData: (data.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // Link any ClickEvent with matching trackingCode
  prisma.clickEvent
    .updateMany({
      where: { trackingCode, convertedLeadId: null },
      data: { convertedLeadId: lead.id },
    })
    .catch((err) => logger.error({ err, trackingCode, leadId: lead.id, action: "link_click_to_lead" }, "Failed to link click event to lead"));

  // Recalculate reputation
  try {
    await reputationService.recalculateReputation(enrollment.affiliateId);
  } catch (err) {
    logger.error({ err, affiliateId: enrollment.affiliateId, leadId: lead.id, action: "recalculate_reputation_after_postback" }, "Failed to recalculate reputation after postback");
  }

  // Advance account gate: FUNDED → LIVE on first successful postback
  await prisma.agent.updateMany({
    where: { id: advertiserId, accountGate: "FUNDED" },
    data: { accountGate: "LIVE" },
  });

  // Fire notification
  notify({
    type: "postback.received",
    data: {
      leadId: lead.id,
      campaignId: enrollment.campaignId,
      affiliateId: enrollment.affiliateId,
      externalId: data.externalId,
    },
  });

  return { lead, created: true };
}

// ---------------------------------------------------------------------------
// Create Referral
// ---------------------------------------------------------------------------

export async function createReferral(
  affiliateId: string,
  data: CreateReferralInput
) {
  // Validate enrollment
  const enrollment = await prisma.affiliateEnrollment.findUnique({
    where: {
      campaignId_affiliateId: {
        campaignId: data.campaignId,
        affiliateId,
      },
    },
    include: {
      campaign: {
        select: { id: true, status: true },
      },
    },
  });

  if (!enrollment || enrollment.status !== "APPROVED") {
    throw new ForbiddenError(
      "You must be enrolled and approved in this campaign"
    );
  }

  if (enrollment.campaign.status !== "ACTIVE") {
    throw new ValidationError("Campaign is not active");
  }

  // Generate HMAC-signed token
  const tokenId = randomUUID();
  const payload = `${affiliateId}:${data.campaignId}:${tokenId}`;
  const signature = createHmac("sha256", REFERRAL_SECRET)
    .update(payload)
    .digest("hex");
  const token = `${tokenId}.${signature}`;

  const expiresAt = new Date(
    Date.now() + data.expiresInHours * 60 * 60 * 1000
  );

  const referral = await prisma.referral.create({
    data: {
      affiliateId,
      campaignId: data.campaignId,
      token,
      status: "PENDING",
      metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
      expiresAt,
    },
  });

  // Fire notification
  notify({
    type: "referral.created",
    data: {
      referralId: referral.id,
      campaignId: data.campaignId,
      affiliateId,
    },
  });

  return referral;
}

// ---------------------------------------------------------------------------
// Confirm Referral
// ---------------------------------------------------------------------------

export async function confirmReferral(
  referralId: string,
  advertiserId: string,
  data: ConfirmReferralInput
) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      campaign: true,
    },
  });

  if (!referral) {
    throw new NotFoundError("Referral", referralId);
  }

  if (referral.campaign.advertiserId !== advertiserId) {
    throw new ForbiddenError("Only the campaign owner can confirm referrals");
  }

  if (referral.status !== "PENDING") {
    throw new ValidationError(
      `Referral cannot be confirmed from status '${referral.status}'`
    );
  }

  if (referral.expiresAt < new Date()) {
    // Mark as expired
    await prisma.referral.update({
      where: { id: referralId },
      data: { status: "EXPIRED" },
    });
    throw new ValidationError("Referral has expired");
  }

  // Compute payout. REV_SHARE requires revenueCents; callers must supply it
  // when confirming a referral against a revenue-share campaign.
  if (
    referral.campaign.compensationModel === "REV_SHARE" &&
    data.revenueCents == null
  ) {
    throw new ValidationError(
      "revenueCents is required when confirming a REV_SHARE campaign referral"
    );
  }
  const payoutCents = escrowService.calculatePayout(referral.campaign, {
    revenueCents: data.revenueCents,
  });

  // Get escrow account
  const escrowAccount = await prisma.escrowAccount.findUnique({
    where: { campaignId: referral.campaignId },
  });

  if (!escrowAccount) {
    throw new ValidationError("Campaign has no escrow account");
  }

  // Create lead as VERIFIED
  const lead = await prisma.lead.create({
    data: {
      campaignId: referral.campaignId,
      affiliateId: referral.affiliateId,
      status: "VERIFIED",
      verifiedAt: new Date(),
      payoutCents,
      currency: referral.campaign.currency,
      leadData: (data.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // Place escrow hold and immediately release. Notify both sides if the
  // advertiser wallet / campaign budget can't cover the payout.
  let hold;
  try {
    hold = await escrowService.placeHold(
      escrowAccount.id,
      lead.id,
      referral.affiliateId,
      payoutCents
    );
  } catch (err) {
    const reason = escrowService.classifyFundingError(err);
    if (reason) {
      notify({
        type: "conversion.funding_failed",
        data: {
          leadId: lead.id,
          campaignId: referral.campaignId,
          campaignName: referral.campaign.name,
          advertiserId: referral.campaign.advertiserId,
          affiliateId: referral.affiliateId,
          payoutCents,
          reason,
        },
      });
    }
    throw err;
  }
  await escrowService.releaseHold(hold.id);

  // Update referral
  const updatedReferral = await prisma.referral.update({
    where: { id: referralId },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedByAgentId: advertiserId,
      leadId: lead.id,
    },
  });

  // Recalculate reputation
  try {
    await reputationService.recalculateReputation(referral.affiliateId);
  } catch (err) {
    logger.error({ err, affiliateId: referral.affiliateId, referralId, action: "recalculate_reputation_after_referral" }, "Failed to recalculate reputation after referral confirmation");
  }

  // Fire notification
  notify({
    type: "referral.confirmed",
    data: {
      referralId,
      leadId: lead.id,
      campaignId: referral.campaignId,
      campaignName: referral.campaign.name,
      affiliateId: referral.affiliateId,
      advertiserId,
      payoutCents,
    },
  });

  return updatedReferral;
}
