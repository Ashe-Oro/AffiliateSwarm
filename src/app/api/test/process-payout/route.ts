import { NextRequest, NextResponse } from "next/server";
import { sendPayout } from "@/services/chain.service";

/**
 * POST /api/test/process-payout — Test-only: process a single CRYPTO payout.
 * Bypasses admin auth so e2e can drive the full onchain payout flow.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const { payoutRequestId } = await req.json();
  if (!payoutRequestId) {
    return NextResponse.json({ error: "payoutRequestId required" }, { status: 400 });
  }

  const result = await sendPayout(payoutRequestId);
  return NextResponse.json({ ok: result.success, data: result });
}
