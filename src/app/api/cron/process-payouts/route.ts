import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPayout, recoverStuckPayout } from "@/services/chain.service";
import { processAchPayout } from "@/services/stripe.service";
import { getResend, FROM } from "@/lib/email";
import { logger } from "@/lib/logger";

// Rows that have been PROCESSING longer than this without reaching a terminal
// state are considered stuck and enter the recovery path. Keep comfortably
// above any realistic happy-path latency (transferUsdc + receipt on Base is
// typically < 30 s) so we don't race the legitimate in-flight worker.
const STUCK_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * GET /api/cron/process-payouts — Auto-process PENDING payout requests and
 * recover rows stuck in PROCESSING.
 *
 * Invoked every 5 minutes by Vercel Cron (see vercel.json). Protected by
 * CRON_SECRET bearer.
 *
 * Two passes per tick:
 *   1. PENDING → dispatch to sendPayout (CRYPTO) / processAchPayout (BANK).
 *   2. PROCESSING > 10 min → recoverStuckPayout, which inspects the chain
 *      transaction row and either resets to PENDING (no tx), finalizes
 *      COMPLETED (tx already confirmed on chain), or finalizes FAILED (tx
 *      errored). Rows still actively in flight are left for the next tick.
 *
 * Underlying services handle idempotency + concurrent races, so it's safe
 * to overlap with manual admin processing.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // -------- Pass 1: PENDING --------
    const pendingPayouts = await prisma.payoutRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
    });

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const payout of pendingPayouts) {
      try {
        if (payout.method === "CRYPTO") {
          const result = await sendPayout(payout.id);
          if (result.success) processed++;
          else {
            failed++;
            console.error(
              `[process-payouts] Failed to process crypto payout ${payout.id}: ${result.error ?? "unknown error"}`
            );
          }
        } else if (payout.method === "BANK_TRANSFER") {
          const result = await processAchPayout(payout.id);
          if (result.success) processed++;
          else {
            failed++;
            console.error(
              `[process-payouts] Failed to process bank payout ${payout.id}: ${result.error ?? "unknown error"}`
            );
          }
        } else {
          // PLATFORM_CREDIT completes inside requestPayout; anything else
          // is unsupported here.
          skipped++;
        }
      } catch (err) {
        failed++;
        console.error(
          `[process-payouts] Failed to process pending payout ${payout.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // -------- Pass 2: PROCESSING > threshold --------
    const stuckCutoff = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS);
    const stuckPayouts = await prisma.payoutRequest.findMany({
      where: {
        status: "PROCESSING",
        processedAt: { lt: stuckCutoff },
      },
      orderBy: { processedAt: "asc" },
    });

    let recoveredCompleted = 0;
    let recoveredFailed = 0;
    let recoveredReset = 0;
    let recoveredInFlight = 0;
    let recoverErrors = 0;

    for (const payout of stuckPayouts) {
      try {
        const result = await recoverStuckPayout(payout.id);
        if (result.outcome === "finalized_completed") recoveredCompleted++;
        else if (result.outcome === "finalized_failed") recoveredFailed++;
        else if (result.outcome === "reset_to_pending") recoveredReset++;
        else if (result.outcome === "in_flight_skipped") recoveredInFlight++;
      } catch (err) {
        recoverErrors++;
        console.error(
          `[process-payouts] Failed to recover stuck payout ${payout.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    const summary = {
      ok: true,
      total: pendingPayouts.length,
      processed,
      failed,
      skipped,
      stuckFound: stuckPayouts.length,
      recoveredCompleted,
      recoveredFailed,
      recoveredReset,
      recoveredInFlight,
      recoverErrors,
    };

    console.log(
      `[process-payouts] total=${summary.total} processed=${processed} failed=${failed} skipped=${skipped} ` +
        `stuckFound=${summary.stuckFound} recoveredCompleted=${recoveredCompleted} recoveredFailed=${recoveredFailed} ` +
        `recoveredReset=${recoveredReset} recoveredInFlight=${recoveredInFlight} recoverErrors=${recoverErrors}`
    );

    // -------- Alerting --------
    // Any non-zero failure or recover_error count alerts an operator. Silent
    // alerting was how #232's 24h stuck-payout episode slipped by unnoticed.
    const problems = failed + recoverErrors;
    if (problems > 0) {
      void sendAdminAlert({
        subject: `[Regatta] process-payouts cron had ${problems} failure${problems === 1 ? "" : "s"}`,
        summary,
      });
    }

    return NextResponse.json(summary);
  } catch (err) {
    console.error("Cron process-payouts error:", err);
    return NextResponse.json(
      { ok: false, error: "Payout processing failed" },
      { status: 500 }
    );
  }
}

async function sendAdminAlert(params: {
  subject: string;
  summary: Record<string, unknown>;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    logger.warn(
      { summary: params.summary },
      "[process-payouts] Non-zero failure count; ADMIN_ALERT_EMAIL not set — not sending email alert"
    );
    return;
  }
  const resend = getResend();
  if (!resend) {
    logger.warn(
      { to, summary: params.summary },
      "[process-payouts] Non-zero failure count; RESEND_API_KEY not set — not sending email alert"
    );
    return;
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: params.subject,
      html: `<pre style="font-family: monospace; font-size: 12px;">${JSON.stringify(
        params.summary,
        null,
        2
      )}</pre>`,
    });
  } catch (err) {
    logger.error(
      { err, to, summary: params.summary },
      "[process-payouts] Failed to send admin alert email"
    );
  }
}
