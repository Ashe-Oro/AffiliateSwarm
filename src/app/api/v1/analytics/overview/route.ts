import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, requireEmailVerified } from "@/lib/auth";
import { AnalyticsOverviewSchema } from "@/lib/validators/analytics";
import { getOverview } from "@/services/analytics.service";
import { AppError } from "@/lib/errors";

/**
 * GET /api/v1/analytics/overview — Aggregate KPIs (authenticated).
 */
export const GET = withAuth(
  requireEmailVerified()(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Always scope to the authenticated agent — never allow override via query params
    const { agentId: _ignored, role: _ignoredRole, ...safeParams } = params;
    const input = { ...safeParams, agentId: agent.id, role: agent.type };
    const parsed = AnalyticsOverviewSchema.safeParse(input);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await getOverview(parsed.data);

    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Analytics overview error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch analytics overview", 500);
  }
}));
