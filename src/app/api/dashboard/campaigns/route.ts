import { NextRequest } from "next/server";
import { getDashboardUser, requireAdvertiserAgent } from "@/lib/auth/dashboard";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as campaignService from "@/services/campaign.service";
import {
  CreateCampaignSchema,
  ListCampaignsSchema,
} from "@/lib/validators/campaign";

export async function GET(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);
    if (agents.length === 0) {
      return errorResponse("NO_AGENT", "No agent found", 400);
    }
    const agent = agents[0];

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = ListCampaignsSchema.safeParse(params);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.flatten()
      );
    }

    const result = await campaignService.listCampaigns(agent.id, parsed.data);

    return paginatedResponse(
      result.campaigns,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });

    const body = await req.json();
    const parsed = CreateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid campaign data",
        400,
        parsed.error.flatten()
      );
    }

    const result = await campaignService.createCampaign(agent.id, parsed.data);

    return successResponse(result, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
