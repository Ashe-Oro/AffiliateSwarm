import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { VerifyLeadSchema } from "@/lib/validators/lead";
import { verifyLead } from "@/services/lead.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ leadId: string }> };

/**
 * POST /api/v1/leads/:leadId/verify — Verify a lead (advertiser/campaign owner only).
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
          const parsed = VerifyLeadSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid verification data",
              400,
              parsed.error.issues
            );
          }

          const lead = await verifyLead(leadId, agent.id, parsed.data);

          return successResponse({
            id: lead.id,
            status: lead.status,
            verifiedAt: lead.verifiedAt,
            qualityScore: lead.qualityScore,
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
          console.error("Lead verify error:", err);
          return errorResponse("INTERNAL_ERROR", "Failed to verify lead", 500);
        }
      }
    )
  )
);
