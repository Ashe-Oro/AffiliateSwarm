import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { activateCampaign } from "@/services/campaign.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * POST /api/v1/campaigns/:campaignId/activate — Activate a draft campaign (owner only).
 */
export const POST = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { campaignId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          const campaign = await activateCampaign(campaignId, agent.id);

          return successResponse({
            id: campaign.id,
            status: campaign.status,
            updatedAt: campaign.updatedAt,
          });
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("Activate campaign error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to activate campaign",
            500
          );
        }
      }
    )
  )
);
