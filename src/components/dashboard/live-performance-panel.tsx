"use client";

import { useCallback, useEffect, useState } from "react";
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
import { formatCents } from "@/lib/format";

interface LeadPerHour {
  hour: string;
  count: number;
}

interface TopAffiliate {
  affiliateId: string;
  displayName: string;
  leadCount: number;
}

interface ActivityItem {
  id: string;
  campaignName: string;
  affiliateName: string;
  status: string;
  payoutCents: number | null;
  submittedAt: string;
}

interface LiveStats {
  leadsPerHour: LeadPerHour[];
  totalLeads24h: number;
  verifiedLeads24h: number;
  conversionRate: number;
  conversionRateLabel: string;
  totalLeadsAllTime: number;
  verifiedLeadsAllTime: number;
  topAffiliates: TopAffiliate[];
  escrow: {
    totalBalanceCents: number;
    totalDepositedCents: number;
    dailyBurnRateCents: number;
    daysRemaining: number | null;
  };
  wallet: {
    availableCents: number;
    heldCents: number;
  };
  activityFeed: ActivityItem[];
  generatedAt: string;
}

function statusVariant(status: string) {
  switch (status) {
    case "VERIFIED":
      return "default" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatHour(iso: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
  });
}

function HourlyBarChart({ data }: { data: LeadPerHour[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex h-[120px] items-end gap-[3px]">
      {data.map((d) => {
        const height = Math.max((d.count / maxCount) * 100, 2);
        return (
          <div
            key={d.hour}
            className="group relative flex h-full flex-1 flex-col items-center justify-end"
          >
            <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-background px-2 py-1 text-xs text-foreground group-hover:block">
              {formatHour(d.hour)}: {d.count}
            </div>
            <div
              className="w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary"
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

const POLL_INTERVAL = 30_000;

export function LivePerformancePanel() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/live-stats", {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message ?? `Request failed (${res.status})`
        );
      }
      const json = await res.json();
      setStats(json.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <section id="live-status" className="space-y-4 scroll-mt-16">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Live Status</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Last-24-hour activity, spend pace, and current campaign movement.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (error && !stats) {
    return (
      <section id="live-status" className="space-y-4 scroll-mt-16">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Live Status</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Last-24-hour activity, spend pace, and current campaign movement.
          </p>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={fetchStats} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!stats) return null;

  const kpis = [
    {
      title: "Leads (24h)",
      value: stats.totalLeads24h.toLocaleString(),
      description: `${stats.verifiedLeads24h} verified in last 24h`,
    },
    {
      title: "Verification Rate",
      value: stats.conversionRateLabel,
      description: `${stats.verifiedLeadsAllTime} of ${stats.totalLeadsAllTime} total`,
    },
    {
      title: "Escrow Balance",
      value: formatCents(stats.escrow.totalBalanceCents),
      description:
        stats.escrow.daysRemaining != null
          ? `~${stats.escrow.daysRemaining} days remaining`
          : "No spend data yet",
    },
    {
      title: "Daily Burn Rate",
      value: formatCents(stats.escrow.dailyBurnRateCents),
      description: "Avg verified payout / day (7d)",
    },
  ];

  return (
    <section id="live-status" className="space-y-4 scroll-mt-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Live Status</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Last-24-hour activity, spend pace, and current campaign movement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-destructive">Update failed</span>
          )}
          <span className="text-xs text-muted-foreground">
            {lastUpdated
              ? `Updated ${relativeTime(lastUpdated.toISOString())}`
              : ""}
          </span>
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.title}</CardDescription>
              <CardTitle className="text-3xl">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Leads per Hour (24h)</CardTitle>
            <CardDescription>
              Hover over bars to see exact counts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HourlyBarChart data={stats.leadsPerHour} />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{formatHour(stats.leadsPerHour[0]?.hour ?? "")}</span>
              <span>
                {formatHour(
                  stats.leadsPerHour[Math.floor(stats.leadsPerHour.length / 2)]
                    ?.hour ?? ""
                )}
              </span>
              <span>
                {formatHour(
                  stats.leadsPerHour[stats.leadsPerHour.length - 1]?.hour ?? ""
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Affiliates</CardTitle>
            <CardDescription>By total lead count.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topAffiliates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No affiliates yet</p>
            ) : (
              <div className="space-y-3">
                {stats.topAffiliates.map((aff, i) => {
                  const maxLeads = stats.topAffiliates[0]?.leadCount ?? 1;
                  const pct = Math.round((aff.leadCount / maxLeads) * 100);
                  return (
                    <div key={aff.affiliateId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {i + 1}. {aff.displayName}
                        </span>
                        <span className="text-muted-foreground">
                          {aff.leadCount}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Last 10 leads across all campaigns.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.activityFeed.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No recent activity
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.activityFeed.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.campaignName}
                      </TableCell>
                      <TableCell>{item.affiliateName}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.status)}>
                          {item.status.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.payoutCents != null
                          ? formatCents(item.payoutCents)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {relativeTime(item.submittedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
