import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { PostbackSchema } from "@/lib/validators/tracking";
import { processPostback } from "@/services/tracking.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/postback — Server-to-server conversion postback (advertiser only).
 */
export const POST = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(async (req: NextRequest) => {
      try {
        const { agent } = getAuthContext(req);

        const body = await req.json();
        const parsed = PostbackSchema.safeParse(body);

        if (!parsed.success) {
          return errorResponse(
            "VALIDATION_ERROR",
            "Invalid postback data",
            400,
            parsed.error.issues
          );
        }

        const result = await processPostback(agent.id, parsed.data);

        if ("test" in result) {
          return successResponse(
            {
              test: true,
              campaignId: result.campaignId,
              externalId: result.externalId,
              trackingConfirmedAt: result.trackingConfirmedAt,
              message: result.message,
            },
            200
          );
        }

        return successResponse(result.lead, result.created ? 201 : 200);
      } catch (err) {
        if (err instanceof AppError) {
          // AppError messages must be integrator-safe by construction.
          // Sensitive context belongs on non-`details` properties.
          return errorResponse(
            err.code,
            err.message,
            err.statusCode,
            err.details
          );
        }
        console.error("Postback error:", err);
        return errorResponse(
          "INTERNAL_ERROR",
          "Failed to process postback",
          500
        );
      }
    })
  )
);
