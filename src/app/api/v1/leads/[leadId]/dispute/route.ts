import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { DisputeLeadSchema } from "@/lib/validators/lead";
import { disputeLead } from "@/services/lead.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ leadId: string }> };

/**
 * POST /api/v1/leads/:leadId/dispute — Dispute a verified lead (advertiser/campaign owner only).
 * Only allowed while the escrow hold is in PENDING_RELEASE (during holding period).
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
          const parsed = DisputeLeadSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid dispute data",
              400,
              parsed.error.issues
            );
          }

          const lead = await disputeLead(leadId, agent.id, parsed.data.reason);

          return successResponse({
            id: lead.id,
            status: lead.status,
            disputedAt: lead.disputedAt,
            disputeReason: lead.disputeReason,
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
          console.error("Lead dispute error:", err);
          return errorResponse("INTERNAL_ERROR", "Failed to dispute lead", 500);
        }
      }
    )
  )
);
