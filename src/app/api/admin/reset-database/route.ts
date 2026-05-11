import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("affiliateswarm_admin_token")?.value;
  const secret = process.env.ADMIN_SECRET;
  return !!(secret && token && token === secret);
}

/**
 * POST /api/admin/reset-database — Truncate all data tables.
 *
 * Safety layers:
 *   1. Admin cookie required
 *   2. Blocked in production (NODE_ENV === "production" AND no ALLOW_DB_RESET flag)
 *   3. Body must include { confirm: "RESET" }
 *
 * Deletes all rows from every data table in dependency order (children first).
 * Schema and migrations are preserved — only data is removed.
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Block in production unless explicitly overridden
  const isProduction = process.env.NODE_ENV === "production";
  const allowReset = process.env.ALLOW_DB_RESET === "true";

  if (isProduction && !allowReset) {
    return NextResponse.json(
      { error: "Database reset is disabled in production" },
      { status: 403 },
    );
  }

  // Require explicit confirmation
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "RESET") {
    return NextResponse.json(
      { error: 'Body must include { "confirm": "RESET" }' },
      { status: 400 },
    );
  }

  // Delete in dependency order (children before parents)
  // Using deleteMany for each table to respect Prisma's type safety
  const deleted = await prisma.$transaction(async (tx) => {
    // Leaf tables (no dependents)
    const requestLog = await tx.requestLog.deleteMany();
    const rateLimitBucket = await tx.rateLimitBucket.deleteMany();
    const domainEvent = await tx.domainEvent.deleteMany();
    const clickEvent = await tx.clickEvent.deleteMany();
    const peerRating = await tx.peerRating.deleteMany();
    const fraudInvestigation = await tx.fraudInvestigation.deleteMany();
    const verificationTask = await tx.verificationTask.deleteMany();
    const chainTransaction = await tx.chainTransaction.deleteMany();
    const stripeCheckoutSession = await tx.stripeCheckoutSession.deleteMany();
    const webhookEndpoint = await tx.webhookEndpoint.deleteMany();
    const apiSession = await tx.apiSession.deleteMany();

    // Payout + ledger + escrow hold layer (escrowHold references lead)
    const payoutRequest = await tx.payoutRequest.deleteMany();
    const ledgerEntry = await tx.ledgerEntry.deleteMany();
    const escrowHold = await tx.escrowHold.deleteMany();

    // Conversion + lead layer (after escrowHold which references lead)
    const conversionEvent = await tx.conversionEvent.deleteMany();
    const lead = await tx.lead.deleteMany();

    // Enrollment layer
    const referral = await tx.referral.deleteMany();
    const affiliateEnrollment = await tx.affiliateEnrollment.deleteMany();

    // Campaign layer
    const escrowAccount = await tx.escrowAccount.deleteMany();
    const campaign = await tx.campaign.deleteMany();

    // Agent layer
    const agentReputation = await tx.agentReputation.deleteMany();
    const apiCredential = await tx.apiCredential.deleteMany();
    const wallet = await tx.wallet.deleteMany();
    const loginCode = await tx.loginCode.deleteMany();
    const userSession = await tx.userSession.deleteMany();
    const userAccount = await tx.userAccount.deleteMany();
    const agent = await tx.agent.deleteMany();

    return {
      agents: agent.count,
      campaigns: campaign.count,
      leads: lead.count,
      conversions: conversionEvent.count,
      enrollments: affiliateEnrollment.count,
      payouts: payoutRequest.count,
      ledgerEntries: ledgerEntry.count,
      wallets: wallet.count,
      events: domainEvent.count,
    };
  });

  return NextResponse.json({
    ok: true,
    message: "Database reset complete",
    deleted,
  });
}
