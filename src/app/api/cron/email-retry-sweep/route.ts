import { NextRequest, NextResponse } from "next/server";
import { ENABLE_EMAIL_RETRY_SWEEP } from "@/lib/feature-flags";
import {
  sweepStaleVerificationEmails,
  sweepStaleOnboardingEmails,
} from "@/services/agent.service";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/email-retry-sweep — Retry stuck verification + onboarding emails.
 *
 * Invoked hourly by Vercel Cron (see vercel.json).
 * Protected by CRON_SECRET header to prevent unauthorized access.
 *
 * Catches the "inline retries exhausted, request died, fire-and-forget didn't
 * land" cases that PR #215/#217's per-request retry can't cover. The DB
 * tracking columns added in PR #217 are what make this query possible.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ENABLE_EMAIL_RETRY_SWEEP()) {
    return NextResponse.json({ ok: true, skipped: "feature flag disabled" });
  }

  try {
    // Run sweeps sequentially. Resend's free tier caps at 5 req/s, and
    // running both sweeps in parallel routinely blew through that cap —
    // which used to kill the whole cron because 429 wasn't a retryable
    // status. sendWithRetry now treats 429 as transient, but serializing
    // here keeps the cron's total Resend pressure halved and simplifies
    // reasoning if organic signups are also firing emails.
    const verification = await sweepStaleVerificationEmails();
    const onboarding = await sweepStaleOnboardingEmails();

    logger.info(
      {
        verification_found: verification.found,
        verification_retried: verification.retried,
        verification_succeeded: verification.succeeded,
        verification_failed: verification.failed,
        onboarding_found: onboarding.found,
        onboarding_retried: onboarding.retried,
        onboarding_succeeded: onboarding.succeeded,
        onboarding_failed: onboarding.failed,
      },
      "[email-retry-sweep] Completed"
    );

    return NextResponse.json({ ok: true, verification, onboarding });
  } catch (err) {
    logger.error({ err }, "[email-retry-sweep] Failed");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
