import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAffiliateAgent } from "@/lib/auth/affiliate-dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as campaignService from "@/services/campaign.service";

const ApplySchema = z.object({
  campaignId: z.string().uuid(),
  pitch: z.string().max(5000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAffiliateAgent(req, {
      requireEmailVerified: true,
    });

    const body = await req.json();
    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid application data",
        400,
        parsed.error.flatten()
      );
    }

    const enrollment = await campaignService.applyToCampaign(
      parsed.data.campaignId,
      agent.id,
      { pitch: parsed.data.pitch }
    );

    return successResponse(enrollment, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
