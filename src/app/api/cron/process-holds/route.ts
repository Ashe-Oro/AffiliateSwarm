import { NextRequest, NextResponse } from "next/server";
import { processMaturedHolds } from "@/services/escrow.service";

/**
 * GET /api/cron/process-holds — Process matured escrow holds.
 *
 * Invoked hourly by Vercel Cron (see vercel.json).
 * Protected by CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await processMaturedHolds();
    return NextResponse.json({
      ok: true,
      processed: results.processed,
      failed: results.failed,
    });
  } catch (err) {
    console.error("Cron process-holds error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
