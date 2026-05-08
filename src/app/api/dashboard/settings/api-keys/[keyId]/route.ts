import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as agentService from "@/services/agent.service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const { agent } = await requireAdvertiserAgent(req);
    const { keyId } = await params;

    await agentService.revokeApiKey(agent.id, keyId, agent.id);

    return successResponse({ revoked: true });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
