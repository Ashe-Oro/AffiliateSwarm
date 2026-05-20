export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
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
import { requireDashboardAuth } from "@/lib/auth/dashboard";
import { CampaignDetailClient } from "@/components/dashboard/campaign-detail-client";
import { CampaignSettingsPanel } from "@/components/dashboard/campaign-settings-panel";
import { TrackingConfirmationCard } from "@/components/dashboard/tracking-confirmation-card";
import { ConversionsTable } from "@/components/dashboard/conversions-table";
import { DEFAULT_APP_URL } from "@/lib/brand";
import { listAdvertiserConversions } from "@/services/conversions.service";

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE || "0.05");

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

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      escrowAccount: true,
      _count: {
        select: {
          leads: true,
          enrollments: true,
        },
      },
    },
  });

  if (!campaign || campaign.advertiserId !== agentId) {
    notFound();
  }

  const isCpa = campaign.compensationModel === "CPA";

  const [leadStats, recentLeads, cpaConversions] = await Promise.all([
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
    isCpa
      ? listAdvertiserConversions({
          advertiserId: agentId,
          campaignId,
          page: 1,
          pageSize: 10,
        })
      : Promise.resolve(null),
  ]);

  const leadCountByStatus = Object.fromEntries(
    leadStats.map((s) => [s.status, s._count])
  );

  const postbackUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_APP_URL}/api/v1/postback`;

  const budgetRemainingCents = Math.max(
    campaign.budgetCents - campaign.budgetSpentCents,
    0
  );
  const payoutsPendingCents = campaign.escrowAccount?.currentBalanceCents ?? 0;
  const payoutsPaidCents = campaign.escrowAccount?.totalReleasedCents ?? 0;

  return (
    <div className="space-y-6">
      <CampaignDetailClient
        campaign={{
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          status: campaign.status,
          compensationModel: campaign.compensationModel,
          payoutPerUnitCents: campaign.payoutPerUnitCents,
          payoutPercentage: campaign.payoutPercentage,
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
      />

      <TrackingConfirmationCard
        campaignStatus={campaign.status}
        testTrackingCode={campaign.testTrackingCode}
        trackingConfirmedAt={
          campaign.trackingConfirmedAt?.toISOString() ?? null
        }
        postbackUrl={postbackUrl}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Original budget</p>
              <p className="text-3xl font-medium">
                {formatCents(campaign.budgetCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Budget remaining</p>
              <p className="text-3xl font-medium">
                {formatCents(budgetRemainingCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Payout</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Payouts pending</p>
              <p className="text-3xl font-medium">
                {formatCents(payoutsPendingCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payouts paid</p>
              <p className="text-3xl font-medium">
                {formatCents(payoutsPaidCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Leads</CardDescription>
            <CardTitle className="text-3xl">
              {campaign._count.leads.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {leadCountByStatus["VERIFIED"] ?? 0} verified,{" "}
              {leadCountByStatus["REJECTED"] ?? 0} rejected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Applications</CardDescription>
            <CardTitle className="text-3xl">
              {campaign._count.enrollments.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Affiliate applications
            </p>
          </CardContent>
        </Card>
      </div>

      <CampaignSettingsPanel
        compensationModel={campaign.compensationModel}
        payoutPerUnitCents={campaign.payoutPerUnitCents}
        payoutPercentage={campaign.payoutPercentage}
        currency={campaign.currency}
        enrollmentPolicy={campaign.enrollmentPolicy}
        landingUrl={campaign.landingUrl}
        geoTargets={campaign.geoTargets}
        categories={campaign.categories}
        budgetCents={campaign.budgetCents}
        dailyCapCount={campaign.dailyCapCount}
        dailyCapCents={campaign.dailyCapCents}
        requiresVerification={campaign.requiresVerification}
        holdingPeriodDays={campaign.holdingPeriodDays}
        buyerIncentiveType={campaign.buyerIncentiveType}
        buyerIncentiveValue={campaign.buyerIncentiveValue}
        buyerIncentiveLabel={campaign.buyerIncentiveLabel}
        buyerCouponCode={campaign.buyerCouponCode}
        platformFeeRate={PLATFORM_FEE_RATE}
        createdAt={campaign.createdAt.toISOString()}
        updatedAt={campaign.updatedAt.toISOString()}
      />

      <div className="flex gap-3">
        <Link href={`/dashboard/campaigns/${campaign.id}/applications`}>
          <Button variant="outline">View Applications</Button>
        </Link>
        {!isCpa && (
          <Link href={`/dashboard/campaigns/${campaign.id}/leads`}>
            <Button variant="outline">View All Leads</Button>
          </Link>
        )}
        {isCpa && (
          <Link href={`/dashboard/performance?campaignId=${campaign.id}#conversions`}>
            <Button variant="outline">View All Conversions</Button>
          </Link>
        )}
      </div>

      {isCpa ? (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Recent Conversions</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            For CPA campaigns, conversions are the source of truth. Dispute a
            conversion during its hold window; after maturity the dispute action
            is disabled and the backend will reject any dispute.
          </p>
          <ConversionsTable
            rows={cpaConversions?.rows ?? []}
            emptyLabel="No conversions yet"
          />
        </div>
      ) : (
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
      )}
    </div>
  );
}
