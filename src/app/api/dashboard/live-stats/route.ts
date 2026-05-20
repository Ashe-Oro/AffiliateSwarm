export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  let auth;
  try {
    auth = await requireAdvertiserAgent(req);
  } catch {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const agentId = auth.agent.id;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLeads24h,
    verifiedLeads24h,
    recentLeads,
    wallet,
    escrowAccounts,
    leads24hRaw,
    spentLast7Days,
    totalLeadsAllTime,
    verifiedLeadsAllTime,
    topAffiliatesRaw,
  ] = await Promise.all([
    // Total leads in last 24h
    prisma.lead.count({
      where: {
        campaign: { advertiserId: agentId },
        submittedAt: { gte: twentyFourHoursAgo },
      },
    }),

    // Verified leads in last 24h
    prisma.lead.count({
      where: {
        campaign: { advertiserId: agentId },
        submittedAt: { gte: twentyFourHoursAgo },
        status: "VERIFIED",
      },
    }),

    // Recent activity feed — last 10 leads
    prisma.lead.findMany({
      where: { campaign: { advertiserId: agentId } },
      include: {
        campaign: { select: { name: true } },
        affiliate: { select: { displayName: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),

    // Wallet balance
    prisma.wallet.findUnique({ where: { agentId } }),

    // Escrow accounts for all campaigns
    prisma.escrowAccount.findMany({
      where: { advertiserId: agentId },
      include: {
        campaign: { select: { name: true, budgetCents: true } },
      },
    }),

    // All leads in last 24h for hourly breakdown
    prisma.lead.findMany({
      where: {
        campaign: { advertiserId: agentId },
        submittedAt: { gte: twentyFourHoursAgo },
      },
      select: { submittedAt: true },
      orderBy: { submittedAt: "asc" },
    }),

    // Total budget spent in last 7 days (for burn rate)
    prisma.lead.aggregate({
      where: {
        campaign: { advertiserId: agentId },
        status: "VERIFIED",
        verifiedAt: { gte: sevenDaysAgo },
        payoutCents: { not: null },
      },
      _sum: { payoutCents: true },
    }),

    // All-time totals for verification rate
    prisma.lead.count({
      where: { campaign: { advertiserId: agentId } },
    }),
    prisma.lead.count({
      where: { campaign: { advertiserId: agentId }, status: "VERIFIED" },
    }),

    // Top 5 affiliates by lead count
    prisma.lead.groupBy({
      by: ["affiliateId"],
      where: { campaign: { advertiserId: agentId } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  // --- Leads per hour (last 24h) ---
  const leadsPerHour: { hour: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const count = leads24hRaw.filter(
      (l) => l.submittedAt >= hourStart && l.submittedAt < hourEnd
    ).length;
    leadsPerHour.push({
      hour: hourStart.toISOString(),
      count,
    });
  }

  const conversionRate =
    totalLeadsAllTime > 0
      ? Math.round((verifiedLeadsAllTime / totalLeadsAllTime) * 10000) / 100
      : 0;

  const affiliateIds = topAffiliatesRaw.map((a) => a.affiliateId);
  const affiliateNames =
    affiliateIds.length > 0
      ? await prisma.agent.findMany({
          where: { id: { in: affiliateIds } },
          select: { id: true, displayName: true },
        })
      : [];
  const nameMap = new Map(affiliateNames.map((a) => [a.id, a.displayName]));

  const topAffiliates = topAffiliatesRaw.map((a) => ({
    affiliateId: a.affiliateId,
    displayName: nameMap.get(a.affiliateId) ?? "Unknown",
    leadCount: a._count.id,
  }));

  // --- Escrow burn rate ---
  const totalEscrowBalance = escrowAccounts.reduce(
    (sum, e) => sum + e.currentBalanceCents,
    0
  );
  const totalEscrowDeposited = escrowAccounts.reduce(
    (sum, e) => sum + e.totalDepositedCents,
    0
  );
  const spentLast7DaysCents = spentLast7Days._sum.payoutCents ?? 0;
  const dailyBurnRate = Math.round(spentLast7DaysCents / 7);
  const daysRemaining =
    dailyBurnRate > 0
      ? Math.round(totalEscrowBalance / dailyBurnRate)
      : null;

  // --- Format recent activity ---
  const activityFeed = recentLeads.map((lead) => ({
    id: lead.id,
    campaignName: lead.campaign.name,
    affiliateName: lead.affiliate.displayName,
    status: lead.status,
    payoutCents: lead.payoutCents,
    submittedAt: lead.submittedAt.toISOString(),
  }));

  return successResponse({
    leadsPerHour,
    totalLeads24h,
    verifiedLeads24h,
    conversionRate,
    conversionRateLabel: `${conversionRate}%`,
    totalLeadsAllTime,
    verifiedLeadsAllTime,
    topAffiliates,
    escrow: {
      totalBalanceCents: totalEscrowBalance,
      totalDepositedCents: totalEscrowDeposited,
      dailyBurnRateCents: dailyBurnRate,
      daysRemaining,
    },
    wallet: {
      availableCents: wallet?.availableCents ?? 0,
      heldCents: wallet?.heldCents ?? 0,
    },
    activityFeed,
    generatedAt: now.toISOString(),
  });
}
