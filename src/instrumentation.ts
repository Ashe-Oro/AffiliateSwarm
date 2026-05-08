/**
 * Next.js instrumentation — runs once at server startup.
 * Validates required environment variables before accepting any requests.
 */
export async function register() {
  if (process.env.NODE_ENV === "production") {
    const required = [
      "DATABASE_URL",
      "NEXT_PUBLIC_APP_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "ADMIN_SECRET",
      "CDP_API_KEY_ID",
      "CDP_API_KEY_PRIVATE_KEY",
      "CDP_WALLET_SECRET",
      "BASE_RPC_URL",
      "CHAIN_NETWORK",
    ];

    const missing = required.filter((key) => !process.env[key]?.trim());

    if (missing.length > 0) {
      console.error(
        `[STARTUP] Missing required environment variables: ${missing.join(", ")}`
      );
      // Don't crash — log loudly so it's visible in monitoring.
      // CDP_* vars are only needed for chain operations.
    }

    const recommended = ["NEXT_PUBLIC_SHORT_URL", "CRON_SECRET", "RESEND_API_KEY"];
    const missingRecommended = recommended.filter((key) => !process.env[key]?.trim());

    if (missingRecommended.length > 0) {
      console.warn(
        `[STARTUP] Recommended environment variables not set: ${missingRecommended.join(", ")}`
      );
    }
  }
}
