import { NextRequest } from "next/server";
import { paginatedResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { ListTransactionsSchema } from "@/lib/validators/escrow";
import { getTransactions } from "@/services/escrow.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * GET /api/v1/wallets/:agentId/transactions — List wallet transactions (authenticated, own wallet only).
 */
export const GET = withAuth(
  async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
    try {
      const { agentId } = await (ctx as RouteContext).params;
      const { agent } = getAuthContext(req);

      if (agent.id !== agentId) {
        return errorResponse("FORBIDDEN", "You can only view your own transactions", 403);
      }

      const url = new URL(req.url);
      const params = Object.fromEntries(url.searchParams.entries());
      const parsed = ListTransactionsSchema.safeParse(params);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid filter parameters",
          400,
          parsed.error.issues
        );
      }

      const result = await getTransactions(agentId, parsed.data);

      return paginatedResponse(
        result.transactions,
        result.page,
        result.pageSize,
        result.totalCount
      );
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      console.error("List transactions error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to list transactions", 500);
    }
  }
);
