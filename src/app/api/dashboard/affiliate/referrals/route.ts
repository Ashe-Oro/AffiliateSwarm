import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAffiliateAgent } from "@/lib/auth/affiliate-dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { createReferral } from "@/services/tracking.service";

const CreateReferralSchema = z.object({
  campaignId: z.string().uuid(),
  expiresInHours: z.number().int().min(1).max(8760).default(720),
});

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAffiliateAgent(req, {
      requireEmailVerified: true,
    });

    const body = await req.json();
    const parsed = CreateReferralSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid referral request",
        400
      );
    }

    const referral = await createReferral(agent.id, parsed.data);

    return successResponse(referral, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
