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
import { prisma } from "@/lib/prisma";
import { requireAffiliateDashboardAuth } from "@/lib/auth/affiliate-dashboard";
import { CancelPayoutButton } from "@/components/affiliate/cancel-payout-button";
import type { Prisma } from "@/generated/prisma/client";
import {
  deriveAffiliateStatus,
  affiliateStatusFilterToWhere,
  type AffiliateConversionStatus,
} from "@/services/conversions.service";
import { getAvailability } from "./availability";

const PAGE_SIZE = 25;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function affiliateStatusVariant(status: AffiliateConversionStatus) {
  switch (status) {
    case "VERIFIED":
      return "default" as const;
    case "REJECTED":
    case "REVERSED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function affiliateStatusLabel(status: AffiliateConversionStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

const AFFILIATE_FILTER_VALUES: readonly AffiliateConversionStatus[] = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "REVERSED",
] as const;

function parseAffiliateFilter(
  raw: string | undefined
): AffiliateConversionStatus | undefined {
  if (!raw) return undefined;
  return (AFFILIATE_FILTER_VALUES as readonly string[]).includes(raw)
    ? (raw as AffiliateConversionStatus)
    : undefined;
}

function payoutStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default" as const;
    case "FAILED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function AffiliateEarningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agent } = await requireAffiliateDashboardAuth();
  const agentId = agent.id;
  const params = await searchParams;

  const leadsPage = Math.max(
    1,
    parseInt(String(params.leadsPage ?? "1"), 10) || 1
  );
  const payoutsPage = Math.max(
    1,
    parseInt(String(params.payoutsPage ?? "1"), 10) || 1
  );
  const statusFilter = parseAffiliateFilter(
    typeof params.status === "string" ? params.status : undefined
  );

  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Per-campaign earnings breakdown
  const campaignEarnings = await prisma.lead.groupBy({
    by: ["campaignId"],
    where: { affiliateId: agentId, status: "VERIFIED" },
    _sum: { payoutCents: true },
    _count: true,
  });

  // Get campaign names
  const campaignIds = campaignEarnings.map((e) => e.campaignId);
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, name: true, compensationModel: true },
  });
  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  // Total earnings
  const totalEarnings = campaignEarnings.reduce(
    (sum, e) => sum + (e._sum.payoutCents ?? 0),
    0
  );

  const leadsWhere: Prisma.LeadWhereInput = {
    affiliateId: agentId,
    ...(statusFilter ? affiliateStatusFilterToWhere(statusFilter, now) : {}),
  };

  // Payout history + leads + wallet + upcoming releases + CPA enrollment flag
  const [
    payouts,
    payoutsCount,
    recentLeads,
    leadsCount,
    wallet,
    releasingIn7Days,
    cpaEnrollmentCount,
  ] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { affiliateId: agentId },
      orderBy: { requestedAt: "desc" },
      skip: (payoutsPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payoutRequest.count({ where: { affiliateId: agentId } }),
    prisma.lead.findMany({
      where: leadsWhere,
      include: { campaign: true, escrowHold: true },
      orderBy: { submittedAt: "desc" },
      skip: (leadsPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lead.count({ where: leadsWhere }),
    prisma.wallet.findUnique({ where: { agentId } }),
    prisma.escrowHold.aggregate({
      where: {
        affiliateId: agentId,
        status: "PENDING_RELEASE",
        releaseAt: { lte: sevenDaysFromNow },
      },
      _sum: { amountCents: true },
    }),
    prisma.affiliateEnrollment.count({
      where: {
        affiliateId: agentId,
        status: "APPROVED",
        campaign: { compensationModel: "CPA" },
      },
    }),
  ]);

  const hasCpaEnrollment = cpaEnrollmentCount > 0;
  const sectionLabel = hasCpaEnrollment ? "Conversions" : "Leads";
  const sectionLabelLower = hasCpaEnrollment ? "conversions" : "leads";

  const availableNowCents = wallet?.availableCents ?? 0;
  const releasingIn7DaysCents = releasingIn7Days._sum.amountCents ?? 0;
  const availableIn7DaysCents = availableNowCents + releasingIn7DaysCents;

  const leadsTotalPages = Math.ceil(leadsCount / PAGE_SIZE);
  const payoutsTotalPages = Math.ceil(payoutsCount / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | number>) {
    const sp = new URLSearchParams();
    if (statusFilter) sp.set("status", statusFilter);
    if (leadsPage > 1) sp.set("leadsPage", String(leadsPage));
    if (payoutsPage > 1) sp.set("payoutsPage", String(payoutsPage));
    for (const [k, v] of Object.entries(overrides)) {
      if (String(v) === "1" || !v) sp.delete(k);
      else sp.set(k, String(v));
    }
    const qs = sp.toString();
    return `/affiliate/earnings${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Earnings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your earnings breakdown, {sectionLabelLower} outcomes, and payout
          history.
        </p>
      </div>

      {/* Earnings overview cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Commissions Earned</CardDescription>
            <CardTitle className="text-3xl">
              {formatCents(totalEarnings)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {campaignEarnings.length} campaign
              {campaignEarnings.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available Now</CardDescription>
            <CardTitle className="text-3xl">
              {formatCents(availableNowCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Cleared and ready to withdraw
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available in 7 Days</CardDescription>
            <CardTitle className="text-3xl">
              {formatCents(availableIn7DaysCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {releasingIn7DaysCents > 0
                ? `${formatCents(releasingIn7DaysCents)} releasing soon`
                : "No additional releases pending"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-campaign breakdown */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">By Campaign</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignEarnings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No verified earnings yet
                  </TableCell>
                </TableRow>
              ) : (
                campaignEarnings
                  .sort(
                    (a, b) =>
                      (b._sum.payoutCents ?? 0) - (a._sum.payoutCents ?? 0)
                  )
                  .map((e) => {
                    const campaign = campaignMap.get(e.campaignId);
                    return (
                      <TableRow key={e.campaignId}>
                        <TableCell className="font-medium">
                          {campaign?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {campaign?.compensationModel ?? "--"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{e._count}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCents(e._sum.payoutCents ?? 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Conversions / Leads table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{sectionLabel}</h3>
          <div className="flex gap-1">
            {[
              { label: "All", value: "" as const },
              { label: "Pending", value: "PENDING" as const },
              { label: "Verified", value: "VERIFIED" as const },
              { label: "Rejected", value: "REJECTED" as const },
              { label: "Reversed", value: "REVERSED" as const },
            ].map((f) => (
              <Link
                key={f.value}
                href={buildUrl({
                  status: f.value,
                  leadsPage: "1",
                })}
              >
                <Button
                  variant={
                    (statusFilter ?? "") === f.value ? "default" : "outline"
                  }
                  size="sm"
                >
                  {f.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
        {hasCpaEnrollment && (
          <p className="mb-3 text-sm text-muted-foreground">
            Conversions show <strong>Pending</strong> while they&apos;re in the
            advertiser&apos;s dispute window, and transition to{" "}
            <strong>Verified</strong> once the window closes and funds are
            released.
          </p>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Availability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No {sectionLabelLower} submitted yet
                  </TableCell>
                </TableRow>
              ) : (
                recentLeads.map((lead) => {
                  const availability = getAvailability(lead, now);
                  const affiliateStatus = deriveAffiliateStatus(
                    lead.status,
                    lead.escrowHold?.status ?? null,
                    lead.escrowHold?.releaseAt ?? null,
                    now
                  );

                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.campaign.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={affiliateStatusVariant(affiliateStatus)}>
                          {affiliateStatusLabel(affiliateStatus)}
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
                      <TableCell>
                        {availability.label === "--" ? (
                          <span className="text-muted-foreground">--</span>
                        ) : (
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge variant={availability.variant}>
                              {availability.label}
                            </Badge>
                            {availability.dateLine && (
                              <span className="text-xs text-muted-foreground">
                                {availability.dateLine}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {leadsTotalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {leadsPage} of {leadsTotalPages} ({leadsCount}{" "}
              {sectionLabelLower})
            </p>
            <div className="flex gap-2">
              {leadsPage > 1 && (
                <Link href={buildUrl({ leadsPage: leadsPage - 1 })}>
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                </Link>
              )}
              {leadsPage < leadsTotalPages && (
                <Link href={buildUrl({ leadsPage: leadsPage + 1 })}>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Payout history pointer — lives on /affiliate/wallet now. */}
      {payoutsCount > 0 && (
        <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-sm text-muted-foreground">
          You have {payoutsCount} payout request{payoutsCount === 1 ? "" : "s"}.{" "}
          <Link
            href="/affiliate/wallet#payout-requests"
            className="font-medium text-primary hover:underline"
          >
            View payout history on your wallet →
          </Link>
        </div>
      )}
    </div>
  );
}
