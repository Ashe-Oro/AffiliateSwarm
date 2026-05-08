import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api-response";
import { withAuth, getAuthContext, requireRole, requireEmailVerified } from "@/lib/auth";
import {
  CreateCampaignSchema,
  ListCampaignsSchema,
} from "@/lib/validators/campaign";
import { createCampaign, listCampaigns } from "@/services/campaign.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/campaigns — Create a new campaign (advertiser only).
 */
export const POST = withAuth(
  requireRole("ADVERTISER")(requireEmailVerified()(async (req: NextRequest) => {
    try {
      const { agent } = getAuthContext(req);
      const body = await req.json();
      const parsed = CreateCampaignSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid campaign data",
          400,
          parsed.error.issues
        );
      }

      const result = await createCampaign(agent.id, parsed.data);

      return successResponse(
        {
          campaign: {
            id: result.campaign.id,
            name: result.campaign.name,
            status: result.campaign.status,
            compensationModel: result.campaign.compensationModel,
            payoutPerUnitCents: result.campaign.payoutPerUnitCents,
            currency: result.campaign.currency,
            budgetCents: result.campaign.budgetCents,
            landingUrl: result.campaign.landingUrl,
            productUrl: result.campaign.productUrl,
            conversionAction: result.campaign.conversionAction,
            productDescription: result.campaign.productDescription,
            brandAssets: result.campaign.brandAssets,
            buyerIncentiveType: result.campaign.buyerIncentiveType,
            buyerIncentiveValue: result.campaign.buyerIncentiveValue,
            buyerIncentiveLabel: result.campaign.buyerIncentiveLabel,
            buyerCouponCode: result.campaign.buyerCouponCode,
            enrollmentPolicy: result.campaign.enrollmentPolicy,
            testTrackingCode: result.campaign.testTrackingCode,
            createdAt: result.campaign.createdAt,
          },
          escrowAccount: {
            id: result.escrowAccount.id,
            currentBalanceCents: result.escrowAccount.currentBalanceCents,
            status: result.escrowAccount.status,
          },
        },
        201
      );
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("Campaign creation error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to create campaign", 500);
    }
  }))
);

/**
 * GET /api/v1/campaigns — List own campaigns (authenticated).
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = ListCampaignsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await listCampaigns(agent.id, parsed.data);

    return paginatedResponse(
      result.campaigns,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Campaign list error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list campaigns", 500);
  }
});
