import { NextRequest } from "next/server";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
} from "@/lib/api-response";
import { withAuth, getAuthContext, requireRole, requireEmailVerified } from "@/lib/auth";
import { RequestPayoutSchema, ListPayoutsSchema } from "@/lib/validators/escrow";
import { requestPayout, listPayouts } from "@/services/escrow.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/payouts — Request a payout (affiliate only).
 */
export const POST = withAuth(
  requireRole("AFFILIATE")(requireEmailVerified()(async (req: NextRequest) => {
    try {
      const { agent } = getAuthContext(req);
      const body = await req.json();
      const parsed = RequestPayoutSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid payout request data",
          400,
          parsed.error.issues
        );
      }

      const payout = await requestPayout(
        agent.id,
        parsed.data.amountCents,
        parsed.data.method,
        parsed.data.destination as Record<string, unknown>
      );

      return successResponse(
        {
          id: payout.id,
          affiliateId: payout.affiliateId,
          amountCents: payout.amountCents,
          currency: payout.currency,
          method: payout.method,
          status: payout.status,
          requestedAt: payout.requestedAt,
        },
        201
      );
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("Payout request error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to request payout", 500);
    }
  }))
);

/**
 * GET /api/v1/payouts — List payout requests (authenticated).
 */
export const GET = withAuth(
  requireEmailVerified()(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = ListPayoutsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await listPayouts(agent.id, parsed.data);

    return paginatedResponse(
      result.payouts,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("List payouts error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list payouts", 500);
  }
}));
