import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as agentService from "@/services/agent.service";

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req);

    await agentService.deactivateAgent(agent.id, agent.id);

    return successResponse({ deactivated: true });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
