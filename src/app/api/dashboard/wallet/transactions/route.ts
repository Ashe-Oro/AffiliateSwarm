import { NextRequest } from "next/server";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { errorResponse, paginatedResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as escrowService from "@/services/escrow.service";
import { ListTransactionsSchema } from "@/lib/validators/escrow";

export async function GET(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);
    if (agents.length === 0) {
      return errorResponse("NO_AGENT", "No agent found", 400);
    }
    const agent = agents[0];

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = ListTransactionsSchema.safeParse(params);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.flatten()
      );
    }

    const result = await escrowService.getTransactions(agent.id, parsed.data);

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
    throw err;
  }
}
