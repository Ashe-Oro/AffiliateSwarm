import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getWalletResponse } from "../_utils";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * GET /api/v1/wallets/:agentId — Get wallet balance (authenticated, own wallet only; legacy).
 */
export const GET = withAuth(
  async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
    try {
      const { agentId } = await (ctx as RouteContext).params;
      const { agent } = getAuthContext(req);

      if (agent.id !== agentId) {
        return errorResponse("FORBIDDEN", "You can only view your own wallet", 403);
      }

      const wallet = await getWalletResponse(agentId);

      return successResponse(wallet);
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("Get wallet error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to get wallet", 500);
    }
  }
);
