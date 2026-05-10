import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { ENABLE_STRIPE_DEPOSITS } from "@/lib/feature-flags";
import { creditFromCheckout } from "@/services/stripe.service";

/**
 * POST /api/test/process-stripe-checkout — Test-only: process a completed Stripe
 * checkout session without waiting for the webhook.
 *
 * In automated E2E tests, Stripe webhooks may not reach localhost.
 * This endpoint fetches the session from Stripe, checks payment status,
 * and triggers creditFromCheckout() — exactly what the webhook handler does.
 *
 * Only available when NODE_ENV !== "production".
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  if (!ENABLE_STRIPE_DEPOSITS()) {
    return NextResponse.json(
      { error: "Card and bank deposits are not currently available" },
      { status: 400 }
    );
  }

  const { stripeSessionId } = await req.json();

  if (!stripeSessionId) {
    return NextResponse.json({ error: "stripeSessionId required" }, { status: 400 });
  }

  // Find our checkout record by Stripe session ID
  const checkout = await prisma.stripeCheckoutSession.findUnique({
    where: { stripeSessionId },
  });

  if (!checkout) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }

  if (checkout.status === "COMPLETED") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Fetch the actual session from Stripe to verify payment status
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Payment not yet completed", paymentStatus: session.payment_status },
      { status: 422 }
    );
  }

  // Process exactly like the webhook would
  await creditFromCheckout(
    checkout.id,
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null
  );

  return NextResponse.json({ ok: true, checkoutId: checkout.id });
}
