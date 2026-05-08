import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as campaignService from "@/services/campaign.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });
    const { campaignId } = await params;

    const campaign = await campaignService.resumeCampaign(campaignId, agent.id);

    return successResponse(campaign);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
