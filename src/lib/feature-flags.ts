/**
 * Centralized feature flags read from environment variables.
 *
 * Two flag styles:
 *   - `isEnabled`         — opt-IN, defaults to DISABLED unless env is "1" or "true".
 *   - `isEnabledByDefault` — opt-OUT, defaults to ENABLED unless env is "0" or "false".
 *
 * Choose `isEnabledByDefault` for things you want on for all environments by
 * default (reliability primitives) but still want a kill switch for.
 */

function isEnabled(envVar: string): boolean {
  const val = process.env[envVar];
  return val === "1" || val === "true";
}

function isEnabledByDefault(envVar: string): boolean {
  const val = process.env[envVar];
  return val !== "0" && val !== "false";
}

/** Cron-driven retry of stuck verification + onboarding emails (see /api/cron/email-retry-sweep). */
export const ENABLE_EMAIL_RETRY_SWEEP = () =>
  isEnabledByDefault("ENABLE_EMAIL_RETRY_SWEEP");

/** Affiliate dashboard "Reputation" tab and /affiliate/reputation route. Off by default. */
export const ENABLE_AFFILIATE_REPUTATION_TAB = () =>
  isEnabled("ENABLE_AFFILIATE_REPUTATION_TAB");

/** Affiliate dashboard "Referrals" tab and /affiliate/referrals route. Off by default. */
export const ENABLE_AFFILIATE_REFERRALS_TAB = () =>
  isEnabled("ENABLE_AFFILIATE_REFERRALS_TAB");

/** Advertiser Stripe deposits (card/ACH checkout). Off by default for USDC-only launch. */
export const ENABLE_STRIPE_DEPOSITS = () => isEnabled("ENABLE_STRIPE_DEPOSITS");

/** Affiliate Stripe withdrawals/bank payouts. Off by default for USDC-only launch. */
export const ENABLE_STRIPE_WITHDRAWALS = () =>
  isEnabled("ENABLE_STRIPE_WITHDRAWALS");

/** Stripe ACH deposits. Requires ENABLE_STRIPE_DEPOSITS as the parent rail flag. */
export const ENABLE_BANK_TRANSFER = () => isEnabled("ENABLE_BANK_TRANSFER");
