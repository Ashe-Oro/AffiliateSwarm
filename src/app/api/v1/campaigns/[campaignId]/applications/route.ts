import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { ApplyToCampaignSchema } from "@/lib/validators/campaign";
import { applyToCampaign, listApplications, getCampaign } from "@/services/campaign.service";
import { buildTrackingUrl } from "@/lib/tracking-url";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * POST /api/v1/campaigns/:campaignId/applications — Apply to a campaign (affiliate only).
 */
export const POST = withAuth(
  requireRole("AFFILIATE")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { campaignId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          const body = await req.json();
          const parsed = ApplyToCampaignSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid application data",
              400,
              parsed.error.issues
            );
          }

          const enrollment = await applyToCampaign(
            campaignId,
            agent.id,
            parsed.data
          );
          const campaign = await getCampaign(campaignId);

          return successResponse(
            {
              id: enrollment.id,
              campaignId: enrollment.campaignId,
              affiliateId: enrollment.affiliateId,
              status: enrollment.status,
              trackingCode: enrollment.trackingCode,
              ...(enrollment.trackingCode && {
                trackingUrl: buildTrackingUrl(campaign.landingUrl, enrollment.trackingCode, campaign.buyerCouponCode),
              }),
              createdAt: enrollment.createdAt,
            },
            201
          );
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("Campaign application error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to apply to campaign",
            500
          );
        }
      }
    )
  )
);

/**
 * GET /api/v1/campaigns/:campaignId/applications — List applications (campaign owner only).
 */
export const GET = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { campaignId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          const applications = await listApplications(campaignId, agent.id);

          return successResponse(applications);
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("List applications error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to list applications",
            500
          );
        }
      }
    )
  )
);
