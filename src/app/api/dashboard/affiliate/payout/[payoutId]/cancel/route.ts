import { NextRequest } from "next/server";
import { requireAffiliateAgent } from "@/lib/auth/affiliate-dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { cancelPayout } from "@/services/escrow.service";

type RouteContext = { params: Promise<{ payoutId: string }> };

export async function POST(
  req: NextRequest,
  ctx: RouteContext
) {
  try {
    const { agent } = await requireAffiliateAgent(req, {
      requireEmailVerified: true,
    });
    const { payoutId } = await ctx.params;

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
    throw err;
  }
}
