import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// V1 Admin KPI Definitions
// ---------------------------------------------------------------------------
//
// - "Registered" = all non-deleted agents of that type (DUAL counts as both)
// - "Verified" = verificationLevel in [EMAIL_VERIFIED, IDENTITY_VERIFIED]
// - "Ongoing campaigns" = status = ACTIVE
// - Enrollment counts = all AffiliateEnrollment rows (applied/accepted/rejected)
// - Total conversions = all ConversionEvent rows
// - Total leads = all Lead rows
// ---------------------------------------------------------------------------

export interface AdminV1Stats {
  advertisersRegistered: number;
  advertisersVerified: number;
  affiliatesRegistered: number;
  affiliatesVerified: number;
  campaignsOngoing: number;
  affiliatesApplied: number;
  affiliatesAccepted: number;
  affiliatesRejected: number;
  totalConversions: number;
  totalLeads: number;
}

/**
 * Fetch all V1 admin KPIs in a single parallel query batch.
 * All 10 counts run concurrently via Promise.all for minimum latency.
 */
export async function getAdminV1Stats(): Promise<AdminV1Stats> {
  const VERIFIED_LEVELS = ["EMAIL_VERIFIED", "IDENTITY_VERIFIED"] as const;

  const [
    advertisersRegistered,
    advertisersVerified,
    affiliatesRegistered,
    affiliatesVerified,
    campaignsOngoing,
    affiliatesApplied,
    affiliatesAccepted,
    affiliatesRejected,
    totalConversions,
    totalLeads,
  ] = await Promise.all([
    prisma.agent.count({
      where: { deletedAt: null, type: { in: ["ADVERTISER", "DUAL"] } },
    }),
    prisma.agent.count({
      where: {
        deletedAt: null,
        type: { in: ["ADVERTISER", "DUAL"] },
        verificationLevel: { in: [...VERIFIED_LEVELS] },
      },
    }),
    prisma.agent.count({
      where: { deletedAt: null, type: { in: ["AFFILIATE", "DUAL"] } },
    }),
    prisma.agent.count({
      where: {
        deletedAt: null,
        type: { in: ["AFFILIATE", "DUAL"] },
        verificationLevel: { in: [...VERIFIED_LEVELS] },
      },
    }),
    prisma.campaign.count({
      where: { deletedAt: null, status: "ACTIVE" },
    }),
    prisma.affiliateEnrollment.count(),
    prisma.affiliateEnrollment.count({ where: { status: "APPROVED" } }),
    prisma.affiliateEnrollment.count({ where: { status: "REJECTED" } }),
    prisma.conversionEvent.count(),
    prisma.lead.count(),
  ]);

  return {
    advertisersRegistered,
    advertisersVerified,
    affiliatesRegistered,
    affiliatesVerified,
    campaignsOngoing,
    affiliatesApplied,
    affiliatesAccepted,
    affiliatesRejected,
    totalConversions,
    totalLeads,
  };
}

// ---------------------------------------------------------------------------
// Daily Deltas — new counts for today vs yesterday
// ---------------------------------------------------------------------------

export interface AdminV1Deltas {
  advertisersRegistered: number;
  advertisersVerified: number;
  affiliatesRegistered: number;
  affiliatesVerified: number;
  campaignsOngoing: number;
  affiliatesApplied: number;
  affiliatesAccepted: number;
  affiliatesRejected: number;
  totalConversions: number;
  totalLeads: number;
}

/**
 * Compute daily deltas: (new items today) - (new items yesterday).
 * Positive = growth, negative = decline vs previous day.
 */
export async function getAdminV1Deltas(): Promise<AdminV1Deltas> {
  const VERIFIED_LEVELS = ["EMAIL_VERIFIED", "IDENTITY_VERIFIED"] as const;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // Count new items in a window [from, to)
  async function windowCounts(from: Date, to: Date) {
    const window = { gte: from, lt: to };

    const [
      advReg, advVer, affReg, affVer, campaigns,
      applied, accepted, rejected, conversions, leads,
    ] = await Promise.all([
      prisma.agent.count({
        where: { deletedAt: null, type: { in: ["ADVERTISER", "DUAL"] }, createdAt: window },
      }),
      prisma.agent.count({
        where: {
          deletedAt: null, type: { in: ["ADVERTISER", "DUAL"] },
          verificationLevel: { in: [...VERIFIED_LEVELS] }, createdAt: window,
        },
      }),
      prisma.agent.count({
        where: { deletedAt: null, type: { in: ["AFFILIATE", "DUAL"] }, createdAt: window },
      }),
      prisma.agent.count({
        where: {
          deletedAt: null, type: { in: ["AFFILIATE", "DUAL"] },
          verificationLevel: { in: [...VERIFIED_LEVELS] }, createdAt: window,
        },
      }),
      prisma.campaign.count({
        where: { deletedAt: null, createdAt: window },
      }),
      prisma.affiliateEnrollment.count({ where: { createdAt: window } }),
      prisma.affiliateEnrollment.count({ where: { status: "APPROVED", createdAt: window } }),
      prisma.affiliateEnrollment.count({ where: { status: "REJECTED", createdAt: window } }),
      prisma.conversionEvent.count({ where: { createdAt: window } }),
      prisma.lead.count({ where: { submittedAt: window } }),
    ]);

    return {
      advertisersRegistered: advReg,
      advertisersVerified: advVer,
      affiliatesRegistered: affReg,
      affiliatesVerified: affVer,
      campaignsOngoing: campaigns,
      affiliatesApplied: applied,
      affiliatesAccepted: accepted,
      affiliatesRejected: rejected,
      totalConversions: conversions,
      totalLeads: leads,
    };
  }

  const [today, yesterday] = await Promise.all([
    windowCounts(startOfToday, now),
    windowCounts(startOfYesterday, startOfToday),
  ]);

  const keys = Object.keys(today) as (keyof AdminV1Deltas)[];
  const deltas = {} as AdminV1Deltas;
  for (const key of keys) {
    deltas[key] = today[key] - yesterday[key];
  }
  return deltas;
}

// ---------------------------------------------------------------------------
// Growth Timeseries — daily counts grouped by date
// ---------------------------------------------------------------------------

export type TimeseriesPeriod = "7d" | "30d" | "90d" | "all";

export interface TimeseriesPoint {
  date: string; // "2026-03-26"
  advertisers: number;
  affiliates: number;
  campaigns: number;
  leads: number;
  conversions: number;
}

export interface AdminTimeseries {
  period: TimeseriesPeriod;
  points: TimeseriesPoint[];
}

interface RawDateCount {
  date: Date;
  count: bigint;
}

/**
 * Fetch platform growth timeseries grouped by day.
 * Uses raw SQL with DATE_TRUNC for efficient date grouping.
 */
export async function getAdminTimeseries(
  period: TimeseriesPeriod,
): Promise<AdminTimeseries> {
  const sinceDate = getSinceDate(period);
  const whereClause = sinceDate
    ? Prisma.sql`AND "createdAt" >= ${sinceDate}`
    : Prisma.empty;
  const whereClauseSubmitted = sinceDate
    ? Prisma.sql`AND "submittedAt" >= ${sinceDate}`
    : Prisma.empty;

  const [advRows, affRows, campRows, leadRows, convRows] = await Promise.all([
    prisma.$queryRaw<RawDateCount[]>`
      SELECT DATE_TRUNC('day', "createdAt")::date AS date, COUNT(*)::int AS count
      FROM "agents"
      WHERE "deletedAt" IS NULL AND "type" IN ('ADVERTISER', 'DUAL')
      ${whereClause}
      GROUP BY date ORDER BY date
    `,
    prisma.$queryRaw<RawDateCount[]>`
      SELECT DATE_TRUNC('day', "createdAt")::date AS date, COUNT(*)::int AS count
      FROM "agents"
      WHERE "deletedAt" IS NULL AND "type" IN ('AFFILIATE', 'DUAL')
      ${whereClause}
      GROUP BY date ORDER BY date
    `,
    prisma.$queryRaw<RawDateCount[]>`
      SELECT DATE_TRUNC('day', "createdAt")::date AS date, COUNT(*)::int AS count
      FROM "campaigns"
      WHERE "deletedAt" IS NULL
      ${whereClause}
      GROUP BY date ORDER BY date
    `,
    prisma.$queryRaw<RawDateCount[]>`
      SELECT DATE_TRUNC('day', "submittedAt")::date AS date, COUNT(*)::int AS count
      FROM "leads"
      WHERE 1=1
      ${whereClauseSubmitted}
      GROUP BY date ORDER BY date
    `,
    prisma.$queryRaw<RawDateCount[]>`
      SELECT DATE_TRUNC('day', "createdAt")::date AS date, COUNT(*)::int AS count
      FROM "conversion_events"
      WHERE 1=1
      ${whereClause}
      GROUP BY date ORDER BY date
    `,
  ]);

  // Build a lookup for each series
  const toMap = (rows: RawDateCount[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = toISODate(r.date);
      m.set(key, Number(r.count));
    }
    return m;
  };

  const advMap = toMap(advRows);
  const affMap = toMap(affRows);
  const campMap = toMap(campRows);
  const leadMap = toMap(leadRows);
  const convMap = toMap(convRows);

  // Generate complete date range (fill zero for missing days)
  const allDates = new Set<string>();
  [advMap, affMap, campMap, leadMap, convMap].forEach((m) =>
    m.forEach((_, k) => allDates.add(k)),
  );

  // If no data at all, return empty
  if (allDates.size === 0) {
    return { period, points: [] };
  }

  const sortedDates = Array.from(allDates).sort();

  // Fill in all days between min and max
  const start = new Date(sortedDates[0]);
  const end = new Date(sortedDates[sortedDates.length - 1]);
  const points: TimeseriesPoint[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = toISODate(d);
    points.push({
      date: key,
      advertisers: advMap.get(key) ?? 0,
      affiliates: affMap.get(key) ?? 0,
      campaigns: campMap.get(key) ?? 0,
      leads: leadMap.get(key) ?? 0,
      conversions: convMap.get(key) ?? 0,
    });
  }

  return { period, points };
}

function getSinceDate(period: TimeseriesPeriod): Date | null {
  if (period === "all") return null;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[period];
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
