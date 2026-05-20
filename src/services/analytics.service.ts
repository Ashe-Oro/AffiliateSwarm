import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import type {
  AnalyticsOverviewInput,
  CampaignAnalyticsInput,
  TimeseriesInput,
} from "@/lib/validators/analytics";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Ownership Checks
// ---------------------------------------------------------------------------

/**
 * Verify that an agent has access to a campaign's analytics.
 * Advertisers must own the campaign; affiliates must have an APPROVED enrollment.
 */
export async function assertCampaignAccess(
  campaignId: string,
  agentId: string
): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", campaignId);
  }

  // Advertiser owns the campaign
  if (campaign.advertiserId === agentId) return;

  // Affiliate has an approved enrollment
  const enrollment = await prisma.affiliateEnrollment.findFirst({
    where: { campaignId, affiliateId: agentId, status: "APPROVED" },
  });
  if (enrollment) return;

  throw new ForbiddenError(
    "You do not have access to this campaign's analytics"
  );
}

// ---------------------------------------------------------------------------
// Overview KPIs
// ---------------------------------------------------------------------------

export async function getOverview(filters?: AnalyticsOverviewInput) {
  const agentId = filters?.agentId;
  const role = filters?.role;

  const leadWhere: Prisma.LeadWhereInput = {};
  const conversionWhere: Prisma.ConversionEventWhereInput = {};
  const campaignWhere: Prisma.CampaignWhereInput = {
    deletedAt: null,
    status: "ACTIVE",
  };
  const ledgerWhere: Prisma.LedgerEntryWhereInput = {
    entryType: "PAYOUT",
  };

  if (agentId) {
    const isAdvertiser = role === "ADVERTISER" || role === "DUAL";

    if (isAdvertiser) {
      // Advertiser: scope to campaigns they own
      leadWhere.campaign = { advertiserId: agentId };
      conversionWhere.campaign = { advertiserId: agentId };
      campaignWhere.advertiserId = agentId;
      // Revenue: debit entries from the advertiser's account (escrow debits for payouts)
      ledgerWhere.debitAccountId = agentId;
    } else {
      // Affiliate: scope to their own leads/conversions
      leadWhere.affiliateId = agentId;
      conversionWhere.affiliateId = agentId;
      // Affiliates don't own campaigns, so active campaigns count will be 0
      campaignWhere.advertiserId = agentId;
      ledgerWhere.creditAccountId = agentId;
    }
  }

  const [
    totalLeads,
    verifiedLeads,
    totalConversions,
    revenueResult,
    activeCampaigns,
  ] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, status: "VERIFIED" } }),
    prisma.conversionEvent.count({ where: conversionWhere }),
    prisma.ledgerEntry.aggregate({
      where: ledgerWhere,
      _sum: { amountCents: true },
    }),
    prisma.campaign.count({ where: campaignWhere }),
  ]);

  return {
    totalLeads,
    verifiedLeads,
    totalConversions,
    totalRevenueCents: revenueResult._sum.amountCents ?? 0,
    activeCampaigns,
  };
}

// ---------------------------------------------------------------------------
// Campaign Analytics
// ---------------------------------------------------------------------------

export async function getCampaignAnalytics(
  filters: CampaignAnalyticsInput
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: filters.campaignId, deletedAt: null },
  });

  if (!campaign) {
    throw new NotFoundError("Campaign", filters.campaignId);
  }

  const [
    leadsByStatus,
    conversionCount,
    spendResult,
    qualityResult,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { campaignId: filters.campaignId },
      _count: { id: true },
    }),
    prisma.conversionEvent.count({
      where: { campaignId: filters.campaignId },
    }),
    prisma.lead.aggregate({
      where: { campaignId: filters.campaignId, status: "VERIFIED" },
      _sum: { payoutCents: true },
    }),
    prisma.lead.aggregate({
      where: {
        campaignId: filters.campaignId,
        qualityScore: { not: null },
      },
      _avg: { qualityScore: true },
    }),
  ]);

  const leadCountByStatus: Record<string, number> = {};
  let totalLeadCount = 0;
  for (const group of leadsByStatus) {
    leadCountByStatus[group.status] = group._count.id;
    totalLeadCount += group._count.id;
  }

  const conversionRate =
    totalLeadCount > 0 ? conversionCount / totalLeadCount : 0;

  return {
    campaignId: filters.campaignId,
    leadCountByStatus,
    totalLeadCount,
    conversionCount,
    totalSpendCents: spendResult._sum.payoutCents ?? 0,
    conversionRate: Math.round(conversionRate * 10000) / 10000,
    avgLeadQuality: qualityResult._avg.qualityScore
      ? Math.round(qualityResult._avg.qualityScore * 100) / 100
      : null,
  };
}

// ---------------------------------------------------------------------------
// Timeseries
// ---------------------------------------------------------------------------

export async function getTimeseries(filters: TimeseriesInput) {
  const {
    startDate,
    endDate,
    granularity,
    campaignId,
    affiliateId,
    agentId,
    role,
  } = filters;

  // Determine the date_trunc interval
  const truncInterval =
    granularity === "week" ? "week" : granularity === "month" ? "month" : "day";
  const advertiserScope =
    agentId && (role === "ADVERTISER" || role === "DUAL");
  const affiliateScope = agentId && role === "AFFILIATE";
  type QueryParam = string | Date;

  function buildActivityQueryParts(alias: string, dateColumn: string) {
    const params: QueryParam[] = [truncInterval, startDate, endDate];
    const clauses = [
      `${alias}."${dateColumn}" >= $2`,
      `${alias}."${dateColumn}" <= $3`,
    ];
    const addParam = (value: QueryParam) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (campaignId) {
      clauses.push(`${alias}."campaignId" = ${addParam(campaignId)}`);
    }
    if (affiliateId) {
      clauses.push(`${alias}."affiliateId" = ${addParam(affiliateId)}`);
    } else if (affiliateScope) {
      clauses.push(`${alias}."affiliateId" = ${addParam(agentId)}`);
    }
    if (advertiserScope) {
      clauses.push(
        `EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.id = ${alias}."campaignId"
            AND c."advertiserId" = ${addParam(agentId)}
            AND c."deletedAt" IS NULL
        )`
      );
    }

    return { params, whereSql: clauses.join(" AND ") };
  }

  function buildLedgerQueryParts() {
    const params: QueryParam[] = [truncInterval, startDate, endDate];
    const clauses = [
      `le."entryType" = 'PAYOUT'`,
      `le."createdAt" >= $2`,
      `le."createdAt" <= $3`,
    ];
    const addParam = (value: QueryParam) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (affiliateId) {
      clauses.push(`le."creditAccountId" = ${addParam(affiliateId)}`);
    } else if (affiliateScope) {
      clauses.push(`le."creditAccountId" = ${addParam(agentId)}`);
    }
    if (advertiserScope) {
      clauses.push(`le."debitAccountId" = ${addParam(agentId)}`);
    }

    return { params, whereSql: clauses.join(" AND ") };
  }

  const leadQuery = buildActivityQueryParts("l", "submittedAt");
  const conversionQuery = buildActivityQueryParts("ce", "occurredAt");
  const ledgerQuery = buildLedgerQueryParts();

  // Use raw queries for date-based grouping since Prisma groupBy doesn't support date_trunc
  const [leadSeries, conversionSeries, revenueSeries] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ date: Date; count: bigint }>>(
      `SELECT date_trunc($1, l."submittedAt") as date, COUNT(*)::bigint as count
       FROM leads l
       WHERE ${leadQuery.whereSql}
       GROUP BY date ORDER BY date`,
      ...leadQuery.params
    ),
    prisma.$queryRawUnsafe<Array<{ date: Date; count: bigint }>>(
      `SELECT date_trunc($1, ce."occurredAt") as date, COUNT(*)::bigint as count
       FROM conversion_events ce
       WHERE ${conversionQuery.whereSql}
       GROUP BY date ORDER BY date`,
      ...conversionQuery.params
    ),
    prisma.$queryRawUnsafe<Array<{ date: Date; total_cents: bigint }>>(
      `SELECT date_trunc($1, le."createdAt") as date, COALESCE(SUM(le."amountCents"), 0)::bigint as total_cents
       FROM ledger_entries le
       WHERE ${ledgerQuery.whereSql}
       GROUP BY date ORDER BY date`,
      ...ledgerQuery.params
    ),
  ]);

  return {
    granularity,
    startDate,
    endDate,
    leads: leadSeries.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
    conversions: conversionSeries.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
    revenue: revenueSeries.map((r) => ({
      date: r.date,
      totalCents: Number(r.total_cents),
    })),
  };
}
