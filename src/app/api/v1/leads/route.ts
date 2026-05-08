import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api-response";
import { withAuth, getAuthContext, requireRole, requireEmailVerified } from "@/lib/auth";
import { SubmitLeadSchema, ListLeadsSchema } from "@/lib/validators/lead";
import { submitLead, listLeads } from "@/services/lead.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/leads — Submit a new lead (affiliate only).
 */
export const POST = withAuth(
  requireRole("AFFILIATE")(requireEmailVerified()(async (req: NextRequest) => {
    try {
      const { agent } = getAuthContext(req);
      const body = await req.json();
      const parsed = SubmitLeadSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid lead data",
          400,
          parsed.error.issues
        );
      }

      const lead = await submitLead(agent.id, parsed.data);

      return successResponse(
        {
          id: lead.id,
          campaignId: lead.campaignId,
          affiliateId: lead.affiliateId,
          status: lead.status,
          externalId: lead.externalId,
          fingerprintHash: lead.fingerprintHash,
          payoutCents: lead.payoutCents,
          currency: lead.currency,
          submittedAt: lead.submittedAt,
          createdAt: lead.createdAt,
        },
        201
      );
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("Lead submission error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to submit lead", 500);
    }
  }))
);

/**
 * GET /api/v1/leads — List leads (authenticated).
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = ListLeadsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    // Scope leads to the authenticated agent:
    // - Affiliates see only their own leads
    // - Advertisers see leads for their campaigns
    const result = await listLeads(parsed.data, agent.id, agent.type);

    return paginatedResponse(
      result.leads,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Lead list error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list leads", 500);
  }
});
