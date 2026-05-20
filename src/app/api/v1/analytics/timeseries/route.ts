import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, requireEmailVerified } from "@/lib/auth";
import { TimeseriesSchema } from "@/lib/validators/analytics";
import {
  getTimeseries,
  assertCampaignAccess,
} from "@/services/analytics.service";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";

/**
 * GET /api/v1/analytics/timeseries — Daily/weekly/monthly lead/conversion/revenue counts (authenticated).
 *
 * Role-based scoping:
 *  - AFFILIATE / DUAL: affiliateId is forced to the caller's ID (cannot view other affiliates' data).
 *                       If campaignId is provided, the caller must have an approved enrollment.
 *  - ADVERTISER:        If campaignId is provided, the caller must own it.
 *                       If affiliateId is provided, that affiliate must be enrolled in one of the
 *                       caller's campaigns.
 */
export const GET = withAuth(
  requireEmailVerified()(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = TimeseriesSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    const filters = { ...parsed.data };
    filters.agentId = undefined;
    filters.role = undefined;

    // ── Role-based scoping ──────────────────────────────────────────
    if (agent.type === "AFFILIATE" || agent.type === "DUAL") {
      // Affiliates can only see their own data
      filters.affiliateId = agent.id;
      filters.agentId = agent.id;
      filters.role = "AFFILIATE";

      // If they specify a campaign, verify they're enrolled
      if (filters.campaignId) {
        await assertCampaignAccess(filters.campaignId, agent.id);
      }
    } else {
      // ADVERTISER
      filters.agentId = agent.id;
      filters.role = "ADVERTISER";

      if (filters.campaignId) {
        // Must own the campaign
        await assertCampaignAccess(filters.campaignId, agent.id);
      }

      if (filters.affiliateId) {
        // The requested affiliate must be enrolled in at least one of
        // the advertiser's campaigns
        const enrollment = await prisma.affiliateEnrollment.findFirst({
          where: {
            affiliateId: filters.affiliateId,
            status: "APPROVED",
            campaign: { advertiserId: agent.id, deletedAt: null },
          },
        });
        if (!enrollment) {
          throw new ForbiddenError(
            "The requested affiliate is not enrolled in any of your campaigns"
          );
        }
      }

      // If no campaignId or affiliateId, the advertiser gets a timeseries
      // scoped to campaigns they own.
    }

    const result = await getTimeseries(filters);

    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Analytics timeseries error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to fetch timeseries data",
      500
    );
  }
}));
