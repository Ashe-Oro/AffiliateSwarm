import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as agentService from "@/services/agent.service";
import { UpdateAgentSchema } from "@/lib/validators/agent";

export async function PATCH(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req);

    const body = await req.json();
    const parsed = UpdateAgentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid profile data",
        400,
        parsed.error.flatten()
      );
    }

    const updated = await agentService.updateAgent(
      agent.id,
      agent.id,
      parsed.data
    );

    return successResponse(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
