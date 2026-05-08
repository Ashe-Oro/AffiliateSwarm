import { NextRequest, NextResponse } from "next/server";
import { scanForDeposits } from "@/lib/chain/deposit-scanner";

/**
 * GET /api/cron/detect-deposits — Auto-detect USDC deposits on Base.
 *
 * Invoked every 2 minutes by Vercel Cron (see vercel.json).
 * Protected by CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scanForDeposits();

    console.log(
      `[detect-deposits] Scanned blocks ${result.blockRange.from}-${result.blockRange.to}: ` +
        `found=${result.depositsFound} processed=${result.depositsProcessed} ` +
        `skipped=${result.depositsSkipped} dustSkipped=${result.dustDepositsSkipped} ` +
        `errors=${result.errors.length}`
    );

    return NextResponse.json({
      ok: true,
      blockRange: {
        from: result.blockRange.from.toString(),
        to: result.blockRange.to.toString(),
      },
      depositsFound: result.depositsFound,
      depositsProcessed: result.depositsProcessed,
      depositsSkipped: result.depositsSkipped,
      dustDepositsSkipped: result.dustDepositsSkipped,
      errors: result.errors.length,
    });
  } catch (err) {
    console.error("Cron detect-deposits error:", err);
    return NextResponse.json(
      { ok: false, error: "Deposit detection failed" },
      { status: 500 }
    );
  }
}
