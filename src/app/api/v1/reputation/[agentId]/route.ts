import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth } from "@/lib/auth";
import { getReputation, recalculateReputation } from "@/services/reputation.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * GET /api/v1/reputation/:agentId — Get reputation profile (authenticated).
 */
export const GET = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;
    const reputation = await getReputation(agentId);

    return successResponse({
      id: reputation.id,
      agentId: reputation.agentId,
      trustTier: reputation.trustTier,
      overallScore: reputation.overallScore,
      dimensionScores: reputation.dimensionScores,
      totalLeadsSubmitted: reputation.totalLeadsSubmitted,
      totalLeadsVerified: reputation.totalLeadsVerified,
      totalLeadsRejected: reputation.totalLeadsRejected,
      totalConversions: reputation.totalConversions,
      fraudFlagCount: reputation.fraudFlagCount,
      lastRecalculatedAt: reputation.lastRecalculatedAt,
      createdAt: reputation.createdAt,
      updatedAt: reputation.updatedAt,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Get reputation error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to get reputation", 500);
  }
});
