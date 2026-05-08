import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/test/credit-wallet — Test-only: credit an agent's wallet directly.
 * Simulates a deposit landing in the wallet without going through Stripe.
 * Only available when NODE_ENV !== "production".
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

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
