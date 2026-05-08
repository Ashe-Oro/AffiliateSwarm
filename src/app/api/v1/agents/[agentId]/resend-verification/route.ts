import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { resendAgentVerificationEmail } from "@/services/agent.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * POST /api/v1/agents/:agentId/resend-verification
 * Resend the verification email for the authenticated agent (own agent only).
 */
export const POST = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;
    const { agent: authAgent } = getAuthContext(req);

    if (authAgent.id !== agentId) {
      return errorResponse(
        "FORBIDDEN",
        "You can only resend verification for your own agent",
        403
      );
    }

    const result = await resendAgentVerificationEmail(agentId);

    return successResponse({
      ok: true,
      email: result.email,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Resend verification error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to resend verification email", 500);
  }
});
