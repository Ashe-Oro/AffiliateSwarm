import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { RejectLeadSchema } from "@/lib/validators/lead";
import { rejectLead } from "@/services/lead.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ leadId: string }> };

/**
 * POST /api/v1/leads/:leadId/reject — Reject a lead (advertiser/campaign owner only).
 */
export const POST = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { leadId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);
          const body = await req.json();
          const parsed = RejectLeadSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid rejection data",
              400,
              parsed.error.issues
            );
          }

          const lead = await rejectLead(leadId, agent.id, parsed.data.reason);

          return successResponse({
            id: lead.id,
            status: lead.status,
            rejectedAt: lead.rejectedAt,
            rejectionReason: lead.rejectionReason,
          });
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("Lead reject error:", err);
          return errorResponse("INTERNAL_ERROR", "Failed to reject lead", 500);
        }
      }
    )
  )
);
