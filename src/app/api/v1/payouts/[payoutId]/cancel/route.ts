import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, requireRole, requireEmailVerified } from "@/lib/auth";
import { cancelPayout } from "@/services/escrow.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ payoutId: string }> };

/**
 * POST /api/v1/payouts/:payoutId/cancel — Cancel a pending payout (affiliate only).
 */
export const POST = withAuth(
  requireRole("AFFILIATE")(requireEmailVerified()(
    async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
      try {
        const { payoutId } = await (ctx as RouteContext).params;
        const { agent } = getAuthContext(req);

        const payout = await cancelPayout(payoutId, agent.id);

        return successResponse({
          id: payout.id,
          status: payout.status,
          amountCents: payout.amountCents,
          failureReason: payout.failureReason,
        });
      } catch (err) {
        if (err instanceof AppError) {
          return errorResponse(err.code, err.message, err.statusCode, err.details);
        }
        console.error("Cancel payout error:", err);
        return errorResponse("INTERNAL_ERROR", "Failed to cancel payout", 500);
      }
    }
  ))
);
