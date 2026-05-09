import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("affiliateswarm_admin_token")?.value;
  const secret = process.env.ADMIN_SECRET;
  return !!(secret && token && token === secret);
}

/**
 * GET /api/admin/payouts — List all pending payouts for admin review.
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payouts = await prisma.payoutRequest.findMany({
    where: { status: "PENDING" },
    include: {
      affiliate: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { requestedAt: "asc" },
    take: 50,
  });

  return NextResponse.json({ data: payouts });
}

/**
 * POST /api/admin/payouts — Process a pending payout.
 * Body: { payoutId, action: "PROCESS" | "REJECT" }
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { payoutId, action } = await req.json();

  if (!payoutId || !["PROCESS", "REJECT"].includes(action)) {
    return NextResponse.json(
      { error: "payoutId and action (PROCESS|REJECT) required" },
      { status: 400 }
    );
  }

  const payout = await prisma.payoutRequest.findUnique({
    where: { id: payoutId },
  });

  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  if (payout.status !== "PENDING") {
    return NextResponse.json(
      { error: `Payout is ${payout.status}, not PENDING` },
      { status: 400 }
    );
  }

  if (action === "REJECT") {
    await prisma.$transaction(async (tx) => {
      await tx.payoutRequest.update({
        where: { id: payoutId },
        data: { status: "FAILED", failureReason: "Rejected by admin" },
      });

      await tx.wallet.update({
        where: { id: payout.walletId },
        data: {
          availableCents: { increment: payout.amountCents },
          pendingPayoutCents: { decrement: payout.amountCents },
        },
      });
    });

    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  // PROCESS
  if (payout.method === "BANK_TRANSFER") {
    const { processAchPayout } = await import("@/services/stripe.service");
    const result = await processAchPayout(payoutId);
    return NextResponse.json({ ok: result.success, ...result });
  }

  // CRYPTO and other methods: mark as processing (manual handling)
  await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: { status: "PROCESSING", processedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    status: "PROCESSING",
    message: `${payout.method} payout marked as processing — complete manually`,
  });
}
