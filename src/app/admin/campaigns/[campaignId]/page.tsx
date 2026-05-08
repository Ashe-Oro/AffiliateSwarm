export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignDetailClient } from "@/components/dashboard/campaign-detail-client";
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
import { formatCampaignPayout, formatCents } from "@/lib/utils";

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

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      advertiser: true,
      escrowAccount: true,
      _count: {
        select: {
          leads: true,
          enrollments: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const [leadStats, recentLeads] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
    }),
    prisma.lead.findMany({
      where: { campaignId },
      include: { affiliate: true },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);

  const leadCountByStatus = Object.fromEntries(
    leadStats.map((stat) => [stat.status, stat._count])
  );

  const infoCards = [
    {
      title: "Budget",
      value: formatCents(campaign.budgetCents),
      description: `${formatCents(campaign.budgetSpentCents)} spent`,
    },
    {
      title: "Escrow Balance",
      value: formatCents(campaign.escrowAccount?.currentBalanceCents ?? 0),
      description: `${formatCents(campaign.escrowAccount?.totalReleasedCents ?? 0)} released`,
    },
    {
      title: "Total Leads",
      value: campaign._count.leads.toLocaleString(),
      description: `${leadCountByStatus["VERIFIED"] ?? 0} verified, ${leadCountByStatus["REJECTED"] ?? 0} rejected`,
    },
    {
      title: "Applications",
      value: campaign._count.enrollments.toLocaleString(),
      description: "Affiliate applications",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/campaigns"
          className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to campaigns
        </Link>
        <CampaignDetailClient
          campaign={{
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            status: campaign.status,
            payoutPerUnitCents: campaign.payoutPerUnitCents,
            payoutPercentage: campaign.payoutPercentage,
            compensationModel: campaign.compensationModel,
            budgetCents: campaign.budgetCents,
            landingUrl: campaign.landingUrl,
            categories: campaign.categories,
            geoTargets: campaign.geoTargets,
            enrollmentPolicy: campaign.enrollmentPolicy,
            holdingPeriodDays: campaign.holdingPeriodDays,
            dailyCapCount: campaign.dailyCapCount,
            dailyCapCents: campaign.dailyCapCents,
            requiresVerification: campaign.requiresVerification,
            trackingConfirmedAt:
              campaign.trackingConfirmedAt?.toISOString() ?? null,
            buyerIncentiveType: campaign.buyerIncentiveType,
            buyerIncentiveValue: campaign.buyerIncentiveValue,
            buyerIncentiveLabel: campaign.buyerIncentiveLabel,
            buyerCouponCode: campaign.buyerCouponCode,
          }}
          readOnly
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {infoCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Advertiser</dt>
              <dd className="font-medium">{campaign.advertiser.displayName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Advertiser Email</dt>
              <dd className="font-medium">{campaign.advertiser.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Compensation Model</dt>
              <dd className="font-medium">{campaign.compensationModel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Payout per Unit</dt>
              <dd className="font-medium">
                {formatCampaignPayout(campaign)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Enrollment Policy</dt>
              <dd className="font-medium">
                {campaign.enrollmentPolicy.toLowerCase().replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Landing URL</dt>
              <dd className="truncate font-medium">
                {campaign.landingUrl ?? "--"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Geo Targets</dt>
              <dd className="font-medium">
                {campaign.geoTargets.length > 0
                  ? campaign.geoTargets.join(", ")
                  : "All"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Categories</dt>
              <dd className="font-medium">
                {campaign.categories.length > 0
                  ? campaign.categories.join(", ")
                  : "None"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {campaign.createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Holding Period</dt>
              <dd className="font-medium">{campaign.holdingPeriodDays} days</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Requires Verification</dt>
              <dd className="font-medium">
                {campaign.requiresVerification ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tracking Confirmed</dt>
              <dd className="font-medium">
                {campaign.trackingConfirmedAt ? (
                  <Badge variant="default">
                    CONFIRMED{" "}
                    {campaign.trackingConfirmedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Badge>
                ) : (
                  <Badge variant="destructive">NOT CONFIRMED</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Test Tracking Code</dt>
              <dd className="font-mono text-xs">
                {campaign.testTrackingCode ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ref Seed</dt>
              <dd className="font-mono text-xs" title={campaign.refSeed ?? ""}>
                {campaign.refSeed ? `${campaign.refSeed.slice(0, 12)}…` : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Recent Leads</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>External ID</TableHead>
                <TableHead>Affiliate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No leads yet
                  </TableCell>
                </TableRow>
              ) : (
                recentLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-mono text-sm">
                      {lead.externalId ?? lead.id.slice(0, 8)}
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
                      {lead.qualityScore != null ? lead.qualityScore : "--"}
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
