import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { SubmitOnchainDepositSchema } from "@/lib/validators/chain";
import { processOnchainDeposit } from "@/services/chain.service";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);
    const agent = agents[0];
    if (!agent) {
      return errorResponse("NO_AGENT", "No agent found", 400);
    }

    const body = await req.json();
    const parsed = SubmitOnchainDepositSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const result = await processOnchainDeposit(agent.id, parsed.data.txHash);

    return successResponse({
      chainTransactionId: result.chainTransaction.id,
      status: result.chainTransaction.status,
      amountCents: result.chainTransaction.amountCents,
      alreadyProcessed: result.alreadyProcessed,
    }, result.alreadyProcessed ? 200 : 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Verify deposit error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to verify deposit", 500);
  }
}
