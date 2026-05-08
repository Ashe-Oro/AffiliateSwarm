import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { UpdateAgentSchema } from "@/lib/validators/agent";
import { getAgent, updateAgent, deactivateAgent } from "@/services/agent.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * GET /api/v1/agents/:agentId — Get agent profile (authenticated).
 */
export const GET = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;
    const agent = await getAgent(agentId);

    return successResponse({
      id: agent.id,
      type: agent.type,
      displayName: agent.displayName,
      ownerAccountId: agent.ownerAccountId,
      description: agent.description,
      websiteUrl: agent.websiteUrl,
      contactEndpoint: agent.contactEndpoint,
      logoUrl: agent.logoUrl,
      status: agent.status,
      verificationLevel: agent.verificationLevel,
      capabilities: agent.capabilities,
      metadata: agent.metadata,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      wallet: agent.wallet
        ? {
            id: agent.wallet.id,
            currency: agent.wallet.currency,
            availableCents: agent.wallet.availableCents,
            heldCents: agent.wallet.heldCents,
            status: agent.wallet.status,
          }
        : null,
      reputation: agent.reputation
        ? {
            trustTier: agent.reputation.trustTier,
            overallScore: agent.reputation.overallScore,
            totalLeadsSubmitted: agent.reputation.totalLeadsSubmitted,
            totalLeadsVerified: agent.reputation.totalLeadsVerified,
            totalConversions: agent.reputation.totalConversions,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Get agent error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to get agent", 500);
  }
});

/**
 * PATCH /api/v1/agents/:agentId — Update agent profile (authenticated, own agent only).
 */
export const PATCH = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;
    const { agent: authAgent } = getAuthContext(req);

    const body = await req.json();
    const parsed = UpdateAgentSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid update data",
        400,
        parsed.error.issues
      );
    }

    const updated = await updateAgent(agentId, authAgent.id, parsed.data);

    return successResponse({
      id: updated.id,
      type: updated.type,
      displayName: updated.displayName,
      description: updated.description,
      websiteUrl: updated.websiteUrl,
      contactEndpoint: updated.contactEndpoint,
      logoUrl: updated.logoUrl,
      status: updated.status,
      capabilities: updated.capabilities,
      metadata: updated.metadata,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Update agent error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to update agent", 500);
  }
});

/**
 * DELETE /api/v1/agents/:agentId — Deactivate agent (authenticated, own agent only).
 */
export const DELETE = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { agentId } = await (ctx as RouteContext).params;
    const { agent: authAgent } = getAuthContext(req);

    await deactivateAgent(agentId, authAgent.id);

    return successResponse({ message: "Agent deactivated successfully" });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Deactivate agent error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to deactivate agent", 500);
  }
});
