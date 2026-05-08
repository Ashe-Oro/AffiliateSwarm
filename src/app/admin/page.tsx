export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getAdminV1Stats, getAdminV1Deltas } from "@/services/admin-stats.service";
import { ResetDatabaseButton } from "@/components/admin/reset-database-button";
import { GrowthCharts } from "@/components/admin/growth-charts";

export default async function AdminOverviewPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Fetch V1 KPIs + deltas + legacy stats (revenue, leads today) in parallel
  const [stats, deltas, leadsToday, revenueAgg] = await Promise.all([
    getAdminV1Stats(),
    getAdminV1Deltas(),
    prisma.lead.count({ where: { submittedAt: { gte: startOfToday } } }),
    prisma.ledgerEntry.aggregate({
      where: { entryType: "ESCROW_RELEASE" },
      _sum: { amountCents: true },
    }),
  ]);

  const totalRevenueCents = revenueAgg._sum.amountCents ?? 0;
  const totalRevenueDollars = (totalRevenueCents / 100).toLocaleString(
    "en-US",
    { style: "currency", currency: "USD", minimumFractionDigits: 0 },
  );

  const showReset =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DB_RESET === "true";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        {showReset && <ResetDatabaseButton />}
      </div>

      {/* Platform Activity */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Platform Activity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Ongoing Campaigns"
            value={stats.campaignsOngoing}
            description="Active campaigns"
            delta={deltas.campaignsOngoing}
          />
          <KpiCard
            title="Total Leads"
            value={stats.totalLeads}
            description="All leads generated"
            delta={deltas.totalLeads}
          />
          <KpiCard
            title="Leads Today"
            value={leadsToday}
            description="Since midnight"
          />
          <KpiCard
            title="Total Conversions"
            value={stats.totalConversions}
            description="Verified conversions"
            delta={deltas.totalConversions}
          />
        </div>
      </section>

      {/* Advertisers */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Advertisers
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Registered"
            value={stats.advertisersRegistered}
            description="Includes DUAL agents"
            delta={deltas.advertisersRegistered}
          />
          <KpiCard
            title="Verified"
            value={stats.advertisersVerified}
            description="Email or identity verified"
            delta={deltas.advertisersVerified}
          />
          <KpiCard
            title="Revenue"
            value={totalRevenueDollars}
            description="Total escrow released"
            isText
          />
        </div>
      </section>

      {/* Affiliates */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Affiliates
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Registered"
            value={stats.affiliatesRegistered}
            description="Includes DUAL agents"
            delta={deltas.affiliatesRegistered}
          />
          <KpiCard
            title="Verified"
            value={stats.affiliatesVerified}
            description="Email or identity verified"
            delta={deltas.affiliatesVerified}
          />
          <KpiCard
            title="Applied"
            value={stats.affiliatesApplied}
            description="Total applications"
            delta={deltas.affiliatesApplied}
          />
          <KpiCard
            title="Accepted"
            value={stats.affiliatesAccepted}
            description="Approved enrollments"
            delta={deltas.affiliatesAccepted}
          />
          <KpiCard
            title="Rejected"
            value={stats.affiliatesRejected}
            description="Rejected applications"
            delta={deltas.affiliatesRejected}
          />
        </div>
      </section>

      {/* Growth Charts */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Growth Over Time
        </h3>
        <GrowthCharts />
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
  isText = false,
  delta,
}: {
  title: string;
  value: number | string;
  description: string;
  isText?: boolean;
  delta?: number;
}) {
  const display = isText
    ? String(value)
    : typeof value === "number"
      ? value.toLocaleString()
      : value;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-3xl">{display}</CardTitle>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-sm font-medium ${
                delta > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
          {delta === 0 && (
            <span className="text-sm font-medium text-muted-foreground">
              +0
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {description}
          {delta !== undefined && (
            <span className="ml-1 text-muted-foreground/60">vs yesterday</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
