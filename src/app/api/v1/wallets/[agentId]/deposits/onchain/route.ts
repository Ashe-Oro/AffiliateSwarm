import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { SubmitOnchainDepositSchema } from "@/lib/validators/chain";
import { processOnchainDeposit } from "@/services/chain.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

export const POST = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(
      async (
        req: NextRequest,
        ctx?: { params?: Promise<Record<string, string>> }
      ) => {
        try {
          const { agentId } = await (ctx as RouteContext).params;
          const { agent } = getAuthContext(req);

          if (agent.id !== agentId) {
            return errorResponse(
              "FORBIDDEN",
              "You can only submit deposits for your own wallet",
              403
            );
          }

          const body = await req.json();
          const parsed = SubmitOnchainDepositSchema.parse(body);

          const result = await processOnchainDeposit(agentId, parsed.txHash);

          return successResponse(
            {
              chainTransactionId: result.chainTransaction.id,
              status: result.chainTransaction.status,
              amountCents: result.chainTransaction.amountCents,
              alreadyProcessed: result.alreadyProcessed,
            },
            result.alreadyProcessed ? 200 : 201
          );
        } catch (err) {
          if (err instanceof AppError) {
            return errorResponse(
              err.code,
              err.message,
              err.statusCode,
              err.details
            );
          }
          if (err instanceof Error && err.name === "ZodError") {
            return errorResponse(
              "VALIDATION_ERROR",
              "Invalid request body",
              400,
              err
            );
          }
          console.error("Onchain deposit error:", err);
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to process onchain deposit",
            500
          );
        }
      }
    )
  )
);
