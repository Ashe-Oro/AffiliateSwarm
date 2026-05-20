/**
 * Typed accessors for Shopify-related environment variables.
 * All accessors throw at call time (not at module load) so missing config
 * surfaces as a 500 on the affected route rather than a deploy-time crash.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export const shopifyEnv = {
  apiKey: () => required("SHOPIFY_API_KEY"),
  apiSecret: () => required("SHOPIFY_API_SECRET"),
  appUrl: () => required("SHOPIFY_APP_URL"),
  scopes: () =>
    (process.env.SHOPIFY_APP_SCOPES?.trim() || "read_orders,write_orders").split(","),
  apiVersion: () => process.env.SHOPIFY_API_VERSION?.trim() || "2025-01",

  /** Optional override for the AffiliateSwarm postback URL (used in tests). */
  affiliateswarmApiBase: () =>
    process.env.AFFILIATESWARM_API_BASE?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000",
};
