import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import {
  SubmitRatingSchema,
  ListRatingsSchema,
} from "@/lib/validators/reputation";
import { submitRating, listRatings } from "@/services/reputation.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * POST /api/v1/reputation/:agentId/reviews — Submit a peer rating (authenticated).
 */
export const POST = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId: toAgentId } = await (ctx as RouteContext).params;
    const { agent: authAgent } = getAuthContext(req);

    const body = await req.json();
    const parsed = SubmitRatingSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid rating data",
        400,
        parsed.error.issues
      );
    }

    const rating = await submitRating(authAgent.id, toAgentId, parsed.data);

    return successResponse(
      {
        id: rating.id,
        fromAgentId: rating.fromAgentId,
        toAgentId: rating.toAgentId,
        campaignId: rating.campaignId,
        score: rating.score,
        dimensions: rating.dimensions,
        comment: rating.comment,
        createdAt: rating.createdAt,
      },
      201
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Submit rating error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to submit rating", 500);
  }
});

/**
 * GET /api/v1/reputation/:agentId/reviews — List ratings for an agent (authenticated).
 */
export const GET = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parsed = ListRatingsSchema.safeParse(queryParams);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await listRatings(agentId, parsed.data);

    return paginatedResponse(
      result.ratings,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("List ratings error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list ratings", 500);
  }
});
