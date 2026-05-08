export const dynamic = "force-dynamic";

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
import { requireDashboardAuth } from "@/lib/auth/dashboard";
import {
  getOverview,
  getTimeseries,
} from "@/services/analytics.service";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { advertiserAgent } = await requireDashboardAuth();
  const params = await searchParams;
  const agentId = advertiserAgent.id;

  // Period selection
  const period = typeof params.period === "string" ? params.period : "30d";
  const now = new Date();
  const daysMap: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  const days = daysMap[period] ?? 30;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [overview, timeseries] = await Promise.all([
    getOverview({ agentId, role: "ADVERTISER" }),
    getTimeseries({
      startDate,
      endDate: now,
      granularity: days <= 7 ? "day" : days <= 30 ? "day" : "week",
    }),
  ]);

  const maxLeads = Math.max(
    ...timeseries.leads.map((d) => d.count),
    1
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Performance overview and trends.
          </p>
        </div>
        <div className="flex gap-1">
          {["7d", "30d", "90d"].map((p) => (
            <a
              key={p}
              href={`/dashboard/analytics?period=${p}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      </div>

      {/* KPI cards */}
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
            <CardDescription>Revenue</CardDescription>
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

      {/* Leads timeseries */}
      <Card>
        <CardHeader>
          <CardTitle>Leads Over Time</CardTitle>
          <CardDescription>
            Daily lead submissions for the past {days} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeseries.leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-1">
              {timeseries.leads.map((point) => (
                <div key={String(point.date)} className="flex items-center gap-3">
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

      {/* Revenue timeseries table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
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
    </div>
  );
}
