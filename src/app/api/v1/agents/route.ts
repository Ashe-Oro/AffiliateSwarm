import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { RegisterAgentSchema, SearchAgentsSchema } from "@/lib/validators/agent";
import { registerAgent, searchAgents } from "@/services/agent.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/agents — Register a new agent (public, no auth required).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterAgentSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid registration data",
        400,
        parsed.error.issues
      );
    }

    const result = await registerAgent(parsed.data);

    return successResponse(
      {
        agent: {
          id: result.agent.id,
          type: result.agent.type,
          displayName: result.agent.displayName,
          ownerAccountId: result.agent.ownerAccountId,
          status: result.agent.status,
          verificationLevel: result.agent.verificationLevel,
          email: result.agent.email,
          capabilities: result.agent.capabilities,
          audienceSize: result.agent.audienceSize,
          channels: result.agent.channels,
          contentType: result.agent.contentType,
          relevantUrls: result.agent.relevantUrls,
          audienceGeo: result.agent.audienceGeo,
          createdAt: result.agent.createdAt,
        },
        apiKey: result.apiKey,
        wallet: {
          id: result.wallet.id,
          walletType: result.wallet.walletType,
          depositAddress: result.wallet.depositAddress,
          chainAddress: result.wallet.chainAddress,
          currency: result.wallet.currency,
          availableCents: result.wallet.availableCents,
          status: result.wallet.status,
        },
        verificationEmailSent: result.verificationEmailSent,
        ...(result.verificationEmailError && {
          verificationEmailError: result.verificationEmailError,
        }),
      },
      201
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Agent registration error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to register agent", 500);
  }
}

/**
 * GET /api/v1/agents — Search agents (authenticated).
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = SearchAgentsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid search parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await searchAgents(parsed.data);

    return paginatedResponse(
      result.agents,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Agent search error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to search agents", 500);
  }
});
