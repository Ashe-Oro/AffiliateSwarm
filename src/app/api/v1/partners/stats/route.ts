import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { ENABLE_PARTNER_PROGRAM } from "@/lib/feature-flags";

/**
 * GET /api/v1/partners/stats?code=PARTNER_CODE — Get partner earnings and referral stats.
 */
export async function GET(req: NextRequest) {
  if (!ENABLE_PARTNER_PROGRAM()) {
    return errorResponse("NOT_FOUND", "Partner program is not currently available", 404);
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return errorResponse("VALIDATION_ERROR", "Missing code parameter", 400);
  }

  const partner = await prisma.partner.findUnique({
    where: { referralCode: code.toUpperCase() },
    include: {
      referredAgents: {
        include: {
          // We don't include the full agent, just count
        },
      },
    },
  });

  if (!partner) {
    return errorResponse("NOT_FOUND", "Partner not found", 404);
  }

  const referralCount = partner.referredAgents.length;
  const advertiserCount = partner.referredAgents.filter(
    (r) => r.agentType === "ADVERTISER" || r.agentType === "DUAL"
  ).length;
  const affiliateCount = partner.referredAgents.filter(
    (r) => r.agentType === "AFFILIATE" || r.agentType === "DUAL"
  ).length;

  return successResponse({
    partner: {
      displayName: partner.displayName,
      referralCode: partner.referralCode,
      revenueShareBps: partner.revenueShareBps,
      totalEarnedCents: partner.totalEarnedCents,
      pendingCents: partner.pendingCents,
      paidOutCents: partner.paidOutCents,
    },
    referrals: {
      total: referralCount,
      advertisers: advertiserCount,
      affiliates: affiliateCount,
    },
  });
}
