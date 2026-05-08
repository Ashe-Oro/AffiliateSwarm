import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { issueApiKey, listApiKeys } from "@/services/agent.service";
import { AppError, ForbiddenError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * POST /api/v1/agents/:agentId/api-keys — Issue a new API key (authenticated).
 */
export const POST = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;
    const { agent: authAgent } = getAuthContext(req);

    if (authAgent.id !== agentId) {
      throw new ForbiddenError("You can only issue API keys for your own agent");
    }

    let label: string | undefined;
    try {
      const body = await req.json();
      label = typeof body.label === "string" ? body.label : undefined;
    } catch {
      // No body or invalid JSON is fine — label is optional
    }

    const result = await issueApiKey(agentId, label);

    return successResponse(result, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Issue API key error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to issue API key", 500);
  }
});

/**
 * GET /api/v1/agents/:agentId/api-keys — List active API keys (authenticated).
 */
export const GET = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;
    const { agent: authAgent } = getAuthContext(req);

    if (authAgent.id !== agentId) {
      throw new ForbiddenError("You can only view API keys for your own agent");
    }

    const keys = await listApiKeys(agentId);

    return successResponse(keys);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("List API keys error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list API keys", 500);
  }
});
