import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { getLead } from "@/services/lead.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ leadId: string }> };

/**
 * GET /api/v1/leads/:leadId — Get lead details (authenticated).
 * Only the lead's affiliate or the campaign's advertiser can view it.
 */
export const GET = withAuth(
  async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
    try {
      const { agent } = getAuthContext(req);
      const { leadId } = await (ctx as RouteContext).params;
      const lead = await getLead(leadId);

      // Authorization: must be the affiliate who submitted or the campaign owner
      if (lead.affiliateId !== agent.id && lead.campaign.advertiserId !== agent.id) {
        return errorResponse("FORBIDDEN", "You do not have access to this lead", 403);
      }

      return successResponse(lead);
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("Get lead error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to get lead", 500);
    }
  }
);
