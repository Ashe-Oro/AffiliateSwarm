import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { ReviewApplicationSchema } from "@/lib/validators/campaign";
import { reviewApplication, getCampaign } from "@/services/campaign.service";
import { buildTrackingUrl } from "@/lib/tracking-url";
import { AppError } from "@/lib/errors";

type RouteContext = {
  params: Promise<{ campaignId: string; appId: string }>;
};

/**
 * PATCH /api/v1/campaigns/:campaignId/applications/:appId — Review application (owner only).
 */
export const PATCH = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { campaignId, appId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          const body = await req.json();
          const parsed = ReviewApplicationSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid review data",
              400,
              parsed.error.issues
            );
          }

          const enrollment = await reviewApplication(
            campaignId,
            appId,
            agent.id,
            parsed.data
          );
          const campaign = await getCampaign(campaignId);

          const response = {
            ...enrollment,
            ...(enrollment.trackingCode && {
              trackingUrl: buildTrackingUrl(campaign.landingUrl, enrollment.trackingCode, campaign.buyerCouponCode),
            }),
          };
          return successResponse(response);
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("Review application error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to review application",
            500
          );
        }
      }
    )
  )
);
