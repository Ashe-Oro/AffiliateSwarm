import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { UpdateCampaignSchema } from "@/lib/validators/campaign";
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
} from "@/services/campaign.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/v1/campaigns/:campaignId — Get campaign details (authenticated).
 * Campaign owner sees full details including escrow; others see public info only.
 */
export const GET = withAuth(
  async (
    req: NextRequest,
    ctx?: { params?: Promise<Record<string, string>> }
  ) => {
    try {
      const { agent } = getAuthContext(req);
      const { campaignId } = await (ctx as RouteContext).params;
      const campaign = await getCampaign(campaignId);

      // Owner gets full details
      if (campaign.advertiserId === agent.id) {
        return successResponse(campaign);
      }

      if (campaign.status !== "ACTIVE") {
        throw new AppError(
          `Campaign with id '${campaignId}' not found`,
          404,
          "NOT_FOUND"
        );
      }

      // Others get public info only. Strip everything that either leaks
      // internal financial state (escrow, budget spent) OR is owner-only
      // secrets used to control the campaign:
      //   - testTrackingCode: the token the owner fires against /postback
      //     to unlock activation. Leaking it lets a third party prove
      //     tracking and prematurely activate.
      //   - refSeed: seed used to derive per-affiliate tracking codes.
      //     Leaking it lets an attacker spoof arbitrary tracking codes.
      const {
        escrowAccount,
        budgetSpentCents,
        dailyCapCents,
        dailyCapCount,
        leadRequirements,
        targetingCriteria,
        testTrackingCode,
        refSeed,
        ...publicFields
      } = campaign;
      return successResponse(publicFields);
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(
          err.code,
          err.message,
          err.statusCode,
          err.details
        );
      }
      console.error("Get campaign error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to get campaign", 500);
    }
  }
);

/**
 * PATCH /api/v1/campaigns/:campaignId — Update campaign (owner only, draft/paused).
 */
export const PATCH = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { campaignId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          const body = await req.json();
          const parsed = UpdateCampaignSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid update data",
              400,
              parsed.error.issues
            );
          }

          const updated = await updateCampaign(
            campaignId,
            agent.id,
            parsed.data
          );

          return successResponse(updated);
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("Update campaign error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to update campaign",
            500
          );
        }
      }
    )
  )
);

/**
 * DELETE /api/v1/campaigns/:campaignId — Soft delete draft campaign (owner only).
 */
export const DELETE = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { campaignId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          await deleteCampaign(campaignId, agent.id);

          return successResponse({ message: "Campaign deleted successfully" });
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("Delete campaign error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to delete campaign",
            500
          );
        }
      }
    )
  )
);
