import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { ConfirmReferralSchema } from "@/lib/validators/tracking";
import { confirmReferral } from "@/services/tracking.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ referralId: string }> };

/**
 * POST /api/v1/referrals/:referralId/confirm — Confirm a referral (advertiser only).
 */
export const POST = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { referralId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          const body = await req.json();
          const parsed = ConfirmReferralSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid confirmation data",
              400,
              parsed.error.issues
            );
          }

          const referral = await confirmReferral(
            referralId,
            agent.id,
            parsed.data
          );

          return successResponse(referral);
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          console.error("Confirm referral error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to confirm referral",
            500
          );
        }
      }
    )
  )
);
