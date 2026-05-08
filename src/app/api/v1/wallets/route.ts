import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getWalletResponse } from "./_utils";

/**
 * GET /api/v1/wallets — Get the authenticated agent's wallet balance.
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const wallet = await getWalletResponse(agent.id);

    return successResponse(wallet);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Get wallet error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to get wallet", 500);
  }
});
