import { NextRequest } from "next/server";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as escrowService from "@/services/escrow.service";

export async function GET(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);
    if (agents.length === 0) {
      return errorResponse("NO_AGENT", "No agent found", 400);
    }
    const agent = agents[0];

    const wallet = await escrowService.getWallet(agent.id);

    return successResponse(wallet);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
