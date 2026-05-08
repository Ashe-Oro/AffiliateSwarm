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
import { requireDashboardAuth } from "@/lib/auth/dashboard";

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

export default async function DashboardOverviewPage() {
  const { user, advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;

  if (!agentId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome, {user.displayName}
        </h2>
        <p className="text-muted-foreground">
          No agent found. Please contact support.
        </p>
      </div>
    );
  }

  const [
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    verifiedLeads,
    pendingLeads,
    wallet,
    recentLeads,
  ] = await Promise.all([
    prisma.campaign.count({ where: { advertiserId: agentId } }),
    prisma.campaign.count({
      where: { advertiserId: agentId, status: "ACTIVE" },
    }),
    prisma.lead.count({
      where: { campaign: { advertiserId: agentId } },
    }),
    prisma.lead.count({
      where: { campaign: { advertiserId: agentId }, status: "VERIFIED" },
    }),
    prisma.lead.count({
      where: {
        campaign: { advertiserId: agentId },
        status: { in: ["SUBMITTED", "PENDING_VERIFICATION"] },
      },
    }),
    prisma.wallet.findUnique({ where: { agentId } }),
    prisma.lead.findMany({
      where: { campaign: { advertiserId: agentId } },
      include: { campaign: true, affiliate: true },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
  ]);

  const kpis = [
    {
      title: "Total Campaigns",
      value: totalCampaigns.toLocaleString(),
      description: `${activeCampaigns} active`,
    },
    {
      title: "Total Leads",
      value: totalLeads.toLocaleString(),
      description: `${verifiedLeads} verified, ${pendingLeads} pending`,
    },
    {
      title: "Wallet Balance",
      value: formatCents(wallet?.availableCents ?? 0),
      description: "Available balance",
    },
    {
      title: "Pending Payout",
      value: formatCents(wallet?.pendingPayoutCents ?? 0),
      description: "Awaiting processing",
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
              <p className="text-xs text-muted-foreground">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Leads</h3>
          <Link
            href="/dashboard/leads"
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
                <TableHead>Affiliate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No leads yet
                  </TableCell>
                </TableRow>
              ) : (
                recentLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.campaign.name}
                    </TableCell>
                    <TableCell>{lead.affiliate.displayName}</TableCell>
                    <TableCell>
                      <Badge variant={leadStatusVariant(lead.status)}>
                        {lead.status.toLowerCase().replace(/_/g, " ")}
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
