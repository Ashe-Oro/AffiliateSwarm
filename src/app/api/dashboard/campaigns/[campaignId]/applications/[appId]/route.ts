import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as campaignService from "@/services/campaign.service";
import { ReviewApplicationSchema } from "@/lib/validators/campaign";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; appId: string }> }
) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });
    const { campaignId, appId } = await params;

    const body = await req.json();
    const parsed = ReviewApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid review data",
        400,
        parsed.error.flatten()
      );
    }

    const application = await campaignService.reviewApplication(
      campaignId,
      appId,
      agent.id,
      parsed.data
    );

    return successResponse(application);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
