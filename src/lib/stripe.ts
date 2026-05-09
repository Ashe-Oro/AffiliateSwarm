import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

function getStripeClient(): Stripe {
  if (globalForStripe.stripe) return globalForStripe.stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }

  const client = new Stripe(secretKey);

  if (process.env.NODE_ENV !== "production") {
    globalForStripe.stripe = client;
  }

  return client;
}

/** Lazy Stripe client — only throws when actually used, not at import time. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripeClient()[prop as keyof Stripe];
  },
});
