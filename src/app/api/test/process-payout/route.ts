import { NextRequest, NextResponse } from "next/server";
import { sendPayout } from "@/services/chain.service";
import { assertTestRoutesEnabled } from "../_guard";

/**
 * POST /api/test/process-payout — Test-only: process a single CRYPTO payout.
 * Gated by assertTestRoutesEnabled (never reachable unauthenticated in prod).
 */
export async function POST(req: NextRequest) {
  const blocked = assertTestRoutesEnabled(req);
  if (blocked) return blocked;

  const { payoutRequestId } = await req.json();
  if (!payoutRequestId) {
    return NextResponse.json({ error: "payoutRequestId required" }, { status: 400 });
  }

  const result = await sendPayout(payoutRequestId);
  return NextResponse.json({ ok: result.success, data: result });
}
