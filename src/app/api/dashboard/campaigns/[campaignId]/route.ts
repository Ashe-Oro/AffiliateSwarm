import { NextRequest } from "next/server";
import { getDashboardUser, requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as campaignService from "@/services/campaign.service";
import { UpdateCampaignSchema } from "@/lib/validators/campaign";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });
    const { campaignId } = await params;

    await campaignService.deleteCampaign(campaignId, agent.id);

    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { agents } = await getDashboardUser(req);
    if (agents.length === 0) {
      return errorResponse("NO_AGENT", "No agent found", 400);
    }
    const agent = agents[0];
    const { campaignId } = await params;

    const campaign = await campaignService.getCampaign(campaignId);

    if (campaign.advertiserId !== agent.id) {
      return errorResponse(
        "FORBIDDEN",
        "You can only view your own campaigns",
        403
      );
    }

    return successResponse(campaign);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });
    const { campaignId } = await params;

    const body = await req.json();
    const parsed = UpdateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid update data",
        400,
        parsed.error.flatten()
      );
    }

    const campaign = await campaignService.updateCampaign(
      campaignId,
      agent.id,
      parsed.data
    );

    return successResponse(campaign);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
