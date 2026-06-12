import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTestRoutesEnabled } from "../_guard";

/**
 * POST /api/test/credit-wallet — Test-only: credit an agent's wallet directly.
 * Simulates a deposit landing in the wallet without an external payment rail.
 * Gated by assertTestRoutesEnabled (never reachable unauthenticated in prod).
 */
export async function POST(req: NextRequest) {
  const blocked = assertTestRoutesEnabled(req);
  if (blocked) return blocked;

  const { agentId, amountCents } = await req.json();

  if (!agentId || !amountCents || amountCents <= 0) {
    return NextResponse.json(
      { error: "agentId and positive amountCents required" },
      { status: 400 }
    );
  }

  const wallet = await prisma.wallet.update({
    where: { agentId },
    data: {
      availableCents: { increment: amountCents },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      walletId: wallet.id,
      availableCents: wallet.availableCents,
    },
  });
}
