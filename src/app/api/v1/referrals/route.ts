import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, requireRole, requireEmailVerified } from "@/lib/auth";
import { CreateReferralSchema } from "@/lib/validators/tracking";
import { createReferral } from "@/services/tracking.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/referrals — Create a signed referral token (affiliate only).
 */
export const POST = withAuth(
  requireRole("AFFILIATE")(requireEmailVerified()(
    async (req: NextRequest) => {
      try {
        const { agent } = getAuthContext(req);

        const body = await req.json();
        const parsed = CreateReferralSchema.safeParse(body);

        if (!parsed.success) {
          return errorResponse(
            "VALIDATION_ERROR",
            "Invalid referral data",
            400,
            parsed.error.issues
          );
        }

        const referral = await createReferral(agent.id, parsed.data);

        return successResponse(referral, 201);
      } catch (err) {
        if (err instanceof AppError) {
          return errorResponse(err.code, err.message, err.statusCode, err.details);
        }
        console.error("Create referral error:", err);
        return errorResponse("INTERNAL_ERROR", "Failed to create referral", 500);
      }
    }
  ))
);
