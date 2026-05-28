export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import { prisma } from "@/lib/prisma";
import { requireAffiliateDashboardAuth } from "@/lib/auth/affiliate-dashboard";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function leadStatusVariant(status: string) {
  switch (status) {
    case "VERIFIED":
      return "default" as const;
    case "REJECTED":
    case "DISPUTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function formatLeadStatus(status: string) {
  switch (status) {
    case "DISPUTED":
      return "reversed";
    default:
      return status.toLowerCase().replace(/_/g, " ");
  }
}

export default async function AffiliateOverviewPage() {
  const { user, agent } = await requireAffiliateDashboardAuth();
  const agentId = agent.id;

  const [
    enrolledCampaigns,
    totalClicks,
    totalLeads,
    verifiedLeads,
    earningsAgg,
    wallet,
    recentLeads,
  ] = await Promise.all([
    prisma.affiliateEnrollment.count({
      where: { affiliateId: agentId, status: "APPROVED" },
    }),
    prisma.clickEvent.count({
      where: { affiliateId: agentId },
    }),
    prisma.lead.count({
      where: { affiliateId: agentId },
    }),
    prisma.lead.count({
      where: { affiliateId: agentId, status: "VERIFIED" },
    }),
    prisma.lead.aggregate({
      where: { affiliateId: agentId, status: "VERIFIED" },
      _sum: { payoutCents: true },
    }),
    prisma.wallet.findUnique({
      where: { agentId },
      select: { availableCents: true },
    }),
    prisma.lead.findMany({
      where: { affiliateId: agentId },
      include: { campaign: true },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
  ]);

  const totalEarnings = earningsAgg._sum.payoutCents ?? 0;
  // Match requestPayout(): only wallet.availableCents can be withdrawn.
  // Held, pending-release, and pending-payout funds are intentionally excluded.
  const withdrawableBalance = wallet?.availableCents ?? 0;

  const kpis = [
    {
      title: "Active Campaigns",
      value: enrolledCampaigns.toLocaleString(),
      description: "Campaigns you're enrolled in",
    },
    {
      title: "Total Clicks",
      value: totalClicks.toLocaleString(),
      description: "Across all tracking links",
    },
    {
      title: "Total Leads",
      value: totalLeads.toLocaleString(),
      description: `${verifiedLeads} verified`,
    },
    {
      title: "Available to Withdraw",
      value: formatCents(withdrawableBalance),
      description: `${formatCents(totalEarnings)} total earned`,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">
        Welcome, {user.displayName}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.title}</CardDescription>
              <CardTitle className="text-3xl">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Recent Leads</h3>
            <p className="text-sm text-muted-foreground">
              Reversed leads are individual commissions removed during the hold
              window. Payout requests are tracked separately in Earnings.
            </p>
          </div>
          <Link
            href="/affiliate/earnings"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No leads yet. Apply to campaigns to get started.
                  </TableCell>
                </TableRow>
              ) : (
                recentLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.campaign.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={leadStatusVariant(lead.status)}>
                        {formatLeadStatus(lead.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {lead.payoutCents != null
                        ? formatCents(lead.payoutCents)
                        : "--"}
                    </TableCell>
                    <TableCell>
                      {lead.submittedAt.toLocaleDateString("en-US", {
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
    </div>
  );
}
