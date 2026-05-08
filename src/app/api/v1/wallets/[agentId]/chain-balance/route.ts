import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { getOnchainBalance } from "@/services/chain.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

export const GET = withAuth(
  async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
    try {
      const { agentId } = await (ctx as RouteContext).params;
      const { agent } = getAuthContext(req);

      if (agent.id !== agentId) {
        return errorResponse("FORBIDDEN", "You can only check your own chain balance", 403);
      }

      const { prisma } = await import("@/lib/prisma");
      const wallet = await prisma.wallet.findUnique({ where: { agentId } });

      if (!wallet) {
        return errorResponse("NOT_FOUND", "Wallet not found", 404);
      }

      if (!wallet.chainAddress) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Wallet has no chain address. Initialize the wallet first.",
          400
        );
      }

      const balance = await getOnchainBalance(wallet.chainAddress);

      return successResponse({
        chainAddress: wallet.chainAddress,
        balanceUsdc: balance.balanceUsdc,
        balanceCents: balance.balanceCents,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("Chain balance error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to get chain balance", 500);
    }
  }
);
