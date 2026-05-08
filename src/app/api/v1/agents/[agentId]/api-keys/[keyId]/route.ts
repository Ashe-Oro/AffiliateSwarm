import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { revokeApiKey } from "@/services/agent.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string; keyId: string }> };

/**
 * DELETE /api/v1/agents/:agentId/api-keys/:keyId — Revoke an API key (authenticated).
 */
export const DELETE = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId, keyId } = await (ctx as RouteContext).params;
    const { agent: authAgent } = getAuthContext(req);

    await revokeApiKey(agentId, keyId, authAgent.id);

    return successResponse({ message: "API key revoked successfully" });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Revoke API key error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to revoke API key", 500);
  }
});
