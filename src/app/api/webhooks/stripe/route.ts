import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ENABLE_STRIPE_DEPOSITS } from "@/lib/feature-flags";
import {
  handleCheckoutCompleted,
  handleAsyncPaymentSucceeded,
  handleAsyncPaymentFailed,
  handleSessionExpired,
} from "@/services/stripe.service";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!ENABLE_STRIPE_DEPOSITS()) {
    console.warn(
      `[stripe-webhook] Verified ${event.type} ignored because payment rail is disabled`
    );
    return NextResponse.json({ received: true, skipped: "payment rail disabled" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await handleCheckoutCompleted(
          session.id,
          session.payment_status,
          session.payment_intent as string | null
        );
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        await handleAsyncPaymentSucceeded(
          session.id,
          session.payment_intent as string | null
        );
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        await handleAsyncPaymentFailed(session.id);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        await handleSessionExpired(session.id);
        break;
      }
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
    // Return 200 anyway to prevent Stripe from retrying indefinitely
    // The error is logged for investigation
  }

  return NextResponse.json({ received: true });
}
