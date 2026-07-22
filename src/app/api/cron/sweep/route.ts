import { NextRequest, NextResponse } from "next/server";
import { sweepDeposits } from "@/lib/chain/sweep";

/**
 * GET /api/cron/sweep — Sweep USDC deposits to hot wallet.
 *
 * Secured by CRON_SECRET header (set in Vercel Cron config).
 * Call this on a schedule (currently hourly) to ensure
 * deposits are swept and payouts can be processed.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await sweepDeposits();

    return NextResponse.json({
      ok: true,
      swept: summary.swept.length,
      skipped: summary.skipped,
      errors: summary.errors.length,
      totalAmountCents: summary.totalAmountCents,
    });
  } catch (err) {
    console.error("Cron sweep error:", err);
    return NextResponse.json(
      { ok: false, error: "Sweep failed" },
      { status: 500 }
    );
  }
}
