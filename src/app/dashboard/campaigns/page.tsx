export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { computeAdvertiserBudgetCoverage } from "@/services/campaign.service";
import { formatCampaignPayout } from "@/lib/utils";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "PAUSED":
      return "secondary" as const;
    case "DRAFT":
      return "outline" as const;
    case "CANCELLED":
    case "BUDGET_EXHAUSTED":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function campaignTypeLabel(compensationModel: string): string {
  switch (compensationModel) {
    case "CPA":
    case "REV_SHARE":
      return "CPA";
    case "CPL":
      return "CPL";
    case "CPC":
      return "CPC";
    default:
      return compensationModel;
  }
}

function compensationLabel(compensationModel: string): string {
  switch (compensationModel) {
    case "CPA":
      return "Flat fee";
    case "REV_SHARE":
      return "Percent of sale";
    case "CPL":
      return "Cost per Lead";
    case "CPC":
      return "Cost per Click";
    default:
      return compensationModel;
  }
}

export default async function DashboardCampaignsPage() {
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;

  const [campaigns, coverage] = agentId
    ? await Promise.all([
        prisma.campaign.findMany({
          where: { advertiserId: agentId },
          include: { _count: { select: { leads: true } } },
          orderBy: { createdAt: "desc" },
        }),
        computeAdvertiserBudgetCoverage(agentId),
      ])
    : [[], null];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
        <Link href="/dashboard/campaigns/new">
          <Button>Create Campaign</Button>
        </Link>
      </div>

      {coverage?.oversubscribed && (
        <div className="rounded-md border border-[var(--v2-accent-3)] bg-[rgba(255,107,107,0.08)] p-4 text-sm text-[var(--v2-text)]">
          <p className="font-medium">
            Your active campaign budgets exceed your wallet balance.
          </p>
          <p className="mt-1">
            {coverage.activeCampaignCount} active campaign
            {coverage.activeCampaignCount === 1 ? "" : "s"} have{" "}
            <strong>{formatCents(coverage.activeBudgetHeadroomCents)}</strong>{" "}
            of remaining budget, but your wallet only has{" "}
            <strong>{formatCents(coverage.walletAvailableCents)}</strong>{" "}
            available &mdash; a shortfall of{" "}
            <strong>{formatCents(coverage.shortfallCents)}</strong>. Campaigns
            draw from your wallet first-come-first-served, so a busy campaign
            can starve siblings if funds run out. Top up to guarantee coverage.
          </p>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Campaign Type</TableHead>
              <TableHead>Compensation</TableHead>
              <TableHead className="text-right">Payout</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground"
                >
                  No campaigns found.{" "}
                  <Link
                    href="/dashboard/campaigns/new"
                    className="text-primary hover:underline"
                  >
                    Create your first campaign
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>
                      {c.status.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {campaignTypeLabel(c.compensationModel)}
                  </TableCell>
                  <TableCell>
                    {compensationLabel(c.compensationModel)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCampaignPayout(c)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCents(c.budgetCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCents(c.budgetSpentCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {c._count.leads.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {c.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
