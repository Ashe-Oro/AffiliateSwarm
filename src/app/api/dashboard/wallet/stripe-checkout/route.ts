import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import {
  ENABLE_BANK_TRANSFER,
  ENABLE_STRIPE_DEPOSITS,
} from "@/lib/feature-flags";
import { CreateStripeCheckoutSchema } from "@/lib/validators/stripe";
import { createCheckoutSession } from "@/services/stripe.service";

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });

    const body = await req.json();
    const parsed = CreateStripeCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid checkout data",
        400,
        parsed.error.flatten()
      );
    }

    if (!ENABLE_STRIPE_DEPOSITS()) {
      return errorResponse(
        "PAYMENT_METHOD_DISABLED",
        "Card and bank deposits are not currently available. Please deposit USDC on Base.",
        400
      );
    }

    if (parsed.data.paymentMethod === "ach" && !ENABLE_BANK_TRANSFER()) {
      return errorResponse(
        "PAYMENT_METHOD_DISABLED",
        "Bank transfer deposits are not currently available. Please use card or USDC on Base.",
        400
      );
    }

    const result = await createCheckoutSession(
      agent.id,
      parsed.data.amountCents,
      parsed.data.paymentMethod
    );

    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
