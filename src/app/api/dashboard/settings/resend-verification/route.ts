import { NextRequest } from "next/server";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { resendAgentVerificationEmail } from "@/services/agent.service";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);

    const body = await req.json().catch(() => ({}));
    const targetId = body.agentId as string | undefined;

    const agent = targetId
      ? agents.find((a) => a.id === targetId)
      : agents[0];

    if (!agent) {
      return errorResponse("NOT_FOUND", "Agent not found", 404);
    }

    const result = await resendAgentVerificationEmail(agent.id);

    return successResponse({
      ok: true,
      email: result.email,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Dashboard resend verification error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to resend verification email", 500);
  }
}
