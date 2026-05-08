import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, requireEmailVerified } from "@/lib/auth";
import { CampaignAnalyticsSchema } from "@/lib/validators/analytics";
import {
  getCampaignAnalytics,
  assertCampaignAccess,
} from "@/services/analytics.service";
import { AppError } from "@/lib/errors";

/**
 * GET /api/v1/analytics/campaigns/:campaignId — Per-campaign analytics (authenticated).
 * Advertisers must own the campaign; affiliates must have an approved enrollment.
 */
export const GET = withAuth(
  requireEmailVerified()(async (
    req: NextRequest,
    ctx?: { params?: Promise<Record<string, string>> }
  ) => {
    try {
      const { agent } = getAuthContext(req);
      const params = await ctx?.params;
      const parsed = CampaignAnalyticsSchema.safeParse({
        campaignId: params?.campaignId,
      });

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid campaign ID",
          400,
          parsed.error.issues
        );
      }

      // Verify the caller owns or is enrolled in this campaign
      await assertCampaignAccess(parsed.data.campaignId, agent.id);

      const result = await getCampaignAnalytics(parsed.data);

      return successResponse(result);
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("Campaign analytics error:", err);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch campaign analytics",
        500
      );
    }
  })
);
