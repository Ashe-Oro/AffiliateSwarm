import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAffiliateAgent } from "@/lib/auth/affiliate-dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as escrowService from "@/services/escrow.service";

const RequestPayoutSchema = z
  .object({
    amountCents: z.number().int().min(100, "Minimum payout is $1.00"),
    method: z.enum(["CRYPTO"]),
    destination: z.record(z.string(), z.unknown()),
  })
  .refine(
    (data) => {
      const addr = data.destination?.chainAddress;
      return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
    },
    {
      message: "CRYPTO payouts require a valid 0x chain address on Base",
      path: ["destination"],
    }
  );

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAffiliateAgent(req, {
      requireEmailVerified: true,
    });

    const body = await req.json();
    const parsed = RequestPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid payout request",
        400,
        parsed.error.flatten()
      );
    }

    const payout = await escrowService.requestPayout(
      agent.id,
      parsed.data.amountCents,
      parsed.data.method,
      parsed.data.destination
    );

    return successResponse(payout, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
