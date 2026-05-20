export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConversionsTable } from "@/components/dashboard/conversions-table";
import { LivePerformancePanel } from "@/components/dashboard/live-performance-panel";
import { requireDashboardAuth } from "@/lib/auth/dashboard";
import { prisma } from "@/lib/prisma";
import { getOverview, getTimeseries } from "@/services/analytics.service";
import { listAdvertiserConversions } from "@/services/conversions.service";

const PAGE_SIZE = 25;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusVariant(status: string) {
  switch (status) {
    case "VERIFIED":
    case "ATTRIBUTED":
      return "default" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function performanceHref({
  period,
  page,
  campaignId,
  hash,
}: {
  period?: string;
  page?: number;
  campaignId?: string;
  hash?: string;
}) {
  const query = new URLSearchParams();
  if (period) query.set("period", period);
  if (page && page > 1) query.set("page", String(page));
  if (campaignId) query.set("campaignId", campaignId);
  const queryString = query.toString();
  return `/dashboard/performance${queryString ? `?${queryString}` : ""}${
    hash ?? ""
  }`;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;
  const params = await searchParams;
  const period = typeof params.period === "string" ? params.period : "30d";
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const campaignIdFilter =
    typeof params.campaignId === "string" ? params.campaignId : undefined;

  const now = new Date();
  const daysMap: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  const days = daysMap[period] ?? 30;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [overview, timeseries, campaigns] = await Promise.all([
    getOverview({ agentId, role: "ADVERTISER" }),
    getTimeseries({
      agentId,
      role: "ADVERTISER",
      startDate,
      endDate: now,
      granularity: days <= 30 ? "day" : "week",
    }),
    prisma.campaign.findMany({
      where: { advertiserId: agentId, deletedAt: null },
      select: { id: true, name: true, compensationModel: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const maxLeads = Math.max(...timeseries.leads.map((d) => d.count), 1);
  const cpaCampaignIds = new Set(
    campaigns.filter((c) => c.compensationModel === "CPA").map((c) => c.id)
  );
  const hasCpa = cpaCampaignIds.size > 0;
  const nonCpaIds = campaigns
    .filter((c) => c.compensationModel !== "CPA")
    .map((c) => c.id);
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));
  const selectedCampaignName = campaignIdFilter
    ? campaignMap.get(campaignIdFilter)
    : undefined;

  const cpaResult = hasCpa
    ? await listAdvertiserConversions({
        advertiserId: agentId,
        campaignId: campaignIdFilter,
        page,
        pageSize: PAGE_SIZE,
      })
    : { rows: [], totalCount: 0, page, pageSize: PAGE_SIZE };

  const legacyCampaignIds = campaignIdFilter
    ? nonCpaIds.filter((id) => id === campaignIdFilter)
    : nonCpaIds;
  const legacyWhere = { campaignId: { in: legacyCampaignIds } };
  const [legacyConversions, legacyCount, legacyStats] =
    legacyCampaignIds.length > 0
      ? await Promise.all([
          prisma.conversionEvent.findMany({
            where: legacyWhere,
            include: { affiliate: { select: { displayName: true } } },
            orderBy: { occurredAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          }),
          prisma.conversionEvent.count({ where: legacyWhere }),
          prisma.conversionEvent.groupBy({
            by: ["status"],
            where: legacyWhere,
            _count: true,
            _sum: { revenueCents: true },
          }),
        ])
      : [[], 0, []];

  const leadCampaignMap = new Map<string, string>();
  if (hasCpa && cpaResult.rows.length > 0) {
    const leadIds = cpaResult.rows.map((r) => r.leadId);
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, campaignId: true },
    });
    for (const lead of leads) {
      const name = campaignMap.get(lead.campaignId);
      if (name) leadCampaignMap.set(lead.id, name);
    }
  }

  const totalPages = Math.ceil(
    (hasCpa ? cpaResult.totalCount : legacyCount) / PAGE_SIZE
  );
  const totalRevenue = legacyStats.reduce(
    (sum, s) => sum + (s._sum.revenueCents ?? 0),
    0
  );
  const legacyTotalCount = legacyStats.reduce((sum, s) => sum + s._count, 0);
  const legacyVerifiedCount =
    legacyStats.find((s) => s.status === "VERIFIED")?._count ?? 0;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Performance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Trends, live campaign movement, and conversion detail in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["#trends", "Trends"],
            ["#live-status", "Live Status"],
            ["#conversions", "Conversions"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <section id="trends" className="space-y-4 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              Performance Trends
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Leads, conversions, and payout spend over time.
            </p>
          </div>
          <div className="flex gap-1">
            {["7d", "30d", "90d"].map((p) => (
              <Link
                key={p}
                href={performanceHref({
                  period: p,
                  campaignId: campaignIdFilter,
                  hash: "#trends",
                })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-3xl">{overview.totalLeads}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Verified Leads</CardDescription>
              <CardTitle className="text-3xl">
                {overview.verifiedLeads}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversions</CardDescription>
              <CardTitle className="text-3xl">
                {overview.totalConversions}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Payout Spend</CardDescription>
              <CardTitle className="text-3xl">
                {formatCents(overview.totalRevenueCents)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Campaigns</CardDescription>
              <CardTitle className="text-3xl">
                {overview.activeCampaigns}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leads Over Time</CardTitle>
            <CardDescription>
              Lead submissions for the past {days} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timeseries.leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-1">
                {timeseries.leads.map((point) => (
                  <div
                    key={String(point.date)}
                    className="flex items-center gap-3"
                  >
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {point.date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex-1">
                      <div
                        className="h-4 rounded bg-primary"
                        style={{
                          width: `${(point.count / maxLeads) * 100}%`,
                          minWidth: point.count > 0 ? "4px" : "0",
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-medium">
                      {point.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout Spend Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Payout Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeseries.leads.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No data for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeseries.leads.map((point, i) => {
                      const conv = timeseries.conversions[i];
                      const rev = timeseries.revenue[i];
                      return (
                        <TableRow key={String(point.date)}>
                          <TableCell className="text-sm">
                            {point.date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {point.count}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {conv?.count ?? 0}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCents(rev?.totalCents ?? 0)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <LivePerformancePanel />

      <section id="conversions" className="space-y-4 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              Conversion Ledger
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Detailed conversion rows for reconciliation and disputes.
            </p>
          </div>
          {selectedCampaignName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {selectedCampaignName}
              </span>
              <Link
                href={performanceHref({ period, hash: "#conversions" })}
                className="font-medium text-primary hover:underline"
              >
                Clear
              </Link>
            </div>
          )}
        </div>

        {hasCpa && (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total CPA Conversions</CardDescription>
                  <CardTitle className="text-3xl">
                    {cpaResult.totalCount}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>In Hold Window</CardDescription>
                  <CardTitle className="text-3xl">
                    {
                      cpaResult.rows.filter((r) => r.unifiedStatus === "HELD")
                        .length
                    }
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Paid</CardDescription>
                  <CardTitle className="text-3xl">
                    {
                      cpaResult.rows.filter((r) => r.unifiedStatus === "PAID")
                        .length
                    }
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
            <ConversionsTable
              rows={cpaResult.rows}
              emptyLabel="No CPA conversions yet"
              showCampaignColumn
              leadCampaignMap={leadCampaignMap}
            />
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({cpaResult.totalCount}{" "}
                  conversions)
                </p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={performanceHref({
                        period,
                        page: page - 1,
                        campaignId: campaignIdFilter,
                        hash: "#conversions",
                      })}
                    >
                      <Button variant="outline" size="sm">
                        Previous
                      </Button>
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={performanceHref({
                        period,
                        page: page + 1,
                        campaignId: campaignIdFilter,
                        hash: "#conversions",
                      })}
                    >
                      <Button variant="outline" size="sm">
                        Next
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {legacyCampaignIds.length > 0 && (
          <div className="space-y-3">
            <div>
              <h4 className="text-lg font-semibold">Other Campaigns</h4>
              <p className="text-sm text-muted-foreground">
                Conversion events for non-CPA campaigns.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total</CardDescription>
                  <CardTitle className="text-3xl">
                    {legacyTotalCount}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Verified</CardDescription>
                  <CardTitle className="text-3xl">
                    {legacyVerifiedCount}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Tracked Revenue</CardDescription>
                  <CardTitle className="text-3xl">
                    {formatCents(totalRevenue)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legacyConversions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        No conversion events yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    legacyConversions.map((conv) => (
                      <TableRow key={conv.id}>
                        <TableCell className="font-medium">
                          {campaignMap.get(conv.campaignId) ?? "Unknown"}
                        </TableCell>
                        <TableCell>{conv.affiliate.displayName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {conv.actionType.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(conv.status)}>
                            {conv.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {conv.revenueCents != null
                            ? formatCents(conv.revenueCents)
                            : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {conv.payoutCents != null
                            ? formatCents(conv.payoutCents)
                            : "--"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {conv.occurredAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {!hasCpa && legacyCampaignIds.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any campaigns yet.
          </p>
        )}
      </section>
    </div>
  );
}
