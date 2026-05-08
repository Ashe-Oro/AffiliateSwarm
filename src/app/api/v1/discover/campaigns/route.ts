import { NextRequest } from "next/server";
import { errorResponse, paginatedResponse } from "@/lib/api-response";
import { withAuth } from "@/lib/auth";
import { DiscoverCampaignsSchema } from "@/lib/validators/campaign";
import { discoverCampaigns } from "@/services/campaign.service";
import { AppError } from "@/lib/errors";

/**
 * GET /api/v1/discover/campaigns — Discover active campaigns (any authenticated agent).
 */
export const GET = withAuth(
  async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = DiscoverCampaignsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await discoverCampaigns(parsed.data);

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
    console.error("Discover campaigns error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to discover campaigns",
      500
    );
  }
});
