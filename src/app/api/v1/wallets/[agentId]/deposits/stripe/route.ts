import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, requireEmailVerified } from "@/lib/auth";
import {
  ENABLE_BANK_TRANSFER,
  ENABLE_STRIPE_DEPOSITS,
} from "@/lib/feature-flags";
import { CreateStripeCheckoutSchema } from "@/lib/validators/stripe";
import { createCheckoutSession } from "@/services/stripe.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ agentId: string }> };

export const POST = withAuth(
  requireEmailVerified()(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
    try {
      const { agentId } = await (ctx as RouteContext).params;
      const { agent } = getAuthContext(req);

      if (agent.id !== agentId) {
        return errorResponse("FORBIDDEN", "You can only create deposits for your own wallet", 403);
      }

      const body = await req.json();
      const parsed = CreateStripeCheckoutSchema.parse(body);

      if (!ENABLE_STRIPE_DEPOSITS()) {
        return errorResponse(
          "PAYMENT_METHOD_DISABLED",
          "Card and bank deposits are not currently available. Please deposit USDC on Base.",
          400
        );
      }

      if (parsed.paymentMethod === "ach" && !ENABLE_BANK_TRANSFER()) {
        return errorResponse(
          "PAYMENT_METHOD_DISABLED",
          "Bank transfer deposits are not currently available. Please deposit USDC on Base.",
          400
        );
      }

      const result = await createCheckoutSession(
        agentId,
        parsed.amountCents,
        parsed.paymentMethod
      );

      return successResponse(result, 201);
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.statusCode, err.details);
      }
      if (err instanceof Error && err.name === "ZodError") {
        return errorResponse("VALIDATION_ERROR", "Invalid request body", 400, err);
      }
      console.error("Stripe checkout error:", err);
      return errorResponse("INTERNAL_ERROR", "Failed to create checkout session", 500);
    }
  })
);
