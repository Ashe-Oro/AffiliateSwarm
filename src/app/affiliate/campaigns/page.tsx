export const dynamic = "force-dynamic";

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
import { buildTrackingUrl } from "@/lib/tracking-url";
import { requireAffiliateDashboardAuth } from "@/lib/auth/affiliate-dashboard";
import { CopyTrackingLink } from "@/components/affiliate/copy-tracking-link";
import { formatCampaignPayout } from "@/lib/utils";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function enrollmentStatusVariant(status: string) {
  switch (status) {
    case "APPROVED":
      return "default" as const;
    case "PENDING":
      return "secondary" as const;
    case "REJECTED":
    case "REVOKED":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export default async function AffiliateCampaignsPage() {
  const { agent } = await requireAffiliateDashboardAuth();
  const agentId = agent.id;

  // Fetch ALL enrollments, not just APPROVED
  const enrollments = await prisma.affiliateEnrollment.findMany({
    where: { affiliateId: agentId },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
  });

  // Fetch stats only for approved enrollments
  const approvedEnrollments = enrollments.filter((e) => e.status === "APPROVED");
  const stats = await Promise.all(
    approvedEnrollments.map(async (enrollment) => {
      const [clicks, leads, verifiedLeads, earningsAgg] = await Promise.all([
        prisma.clickEvent.count({
          where: {
            affiliateId: agentId,
            campaignId: enrollment.campaignId,
          },
        }),
        prisma.lead.count({
          where: {
            affiliateId: agentId,
            campaignId: enrollment.campaignId,
          },
        }),
        prisma.lead.count({
          where: {
            affiliateId: agentId,
            campaignId: enrollment.campaignId,
            status: "VERIFIED",
          },
        }),
        prisma.lead.aggregate({
          where: {
            affiliateId: agentId,
            campaignId: enrollment.campaignId,
            status: "VERIFIED",
          },
          _sum: { payoutCents: true },
        }),
      ]);
      return {
        enrollmentId: enrollment.id,
        clicks,
        leads,
        verifiedLeads,
        earnings: earningsAgg._sum.payoutCents ?? 0,
      };
    })
  );

  const statsMap = new Map(stats.map((s) => [s.enrollmentId, s]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Campaigns</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your campaign applications and enrollments.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You haven&apos;t applied to any campaigns yet. Use your agent
            to discover and apply to campaigns.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrollments.map((enrollment) => {
            const s = statsMap.get(enrollment.id);
            const trackingUrl = enrollment.trackingCode
              ? buildTrackingUrl(enrollment.campaign.landingUrl, enrollment.trackingCode, enrollment.campaign.buyerCouponCode)
              : null;
            const isApproved = enrollment.status === "APPROVED";

            return (
              <Card key={enrollment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{enrollment.campaign.name}</CardTitle>
                      <CardDescription>
                        {enrollment.campaign.compensationModel} &middot;{" "}
                        {formatCampaignPayout({
                          compensationModel: enrollment.campaign.compensationModel,
                          payoutPerUnitCents: enrollment.campaign.payoutPerUnitCents,
                          payoutPercentage: enrollment.campaign.payoutPercentage,
                        })}
                        {enrollment.campaign.compensationModel !== "REV_SHARE" &&
                          " per conversion"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={enrollmentStatusVariant(enrollment.status)}>
                        {enrollment.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                      <Badge
                        variant={
                          enrollment.campaign.status === "ACTIVE"
                            ? "default"
                            : "secondary"
                        }
                      >
                        campaign {enrollment.campaign.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {enrollment.campaign.buyerIncentiveLabel && (
                    <div className="mb-4 flex items-center gap-2 rounded-md border border-dashed p-2">
                      <Badge variant="outline">Buyer Incentive</Badge>
                      <span className="text-sm text-muted-foreground">
                        {enrollment.campaign.buyerIncentiveLabel}
                      </span>
                      {enrollment.campaign.buyerCouponCode && (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {enrollment.campaign.buyerCouponCode}
                        </code>
                      )}
                    </div>
                  )}

                  {isApproved && (
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Clicks</p>
                        <p className="text-2xl font-semibold">
                          {(s?.clicks ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Leads</p>
                        <p className="text-2xl font-semibold">
                          {(s?.leads ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Verified</p>
                        <p className="text-2xl font-semibold">
                          {(s?.verifiedLeads ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Earnings</p>
                        <p className="text-2xl font-semibold">
                          {formatCents(s?.earnings ?? 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  {enrollment.status === "PENDING" && (
                    <p className="text-sm text-muted-foreground">
                      Your application is pending review by the campaign owner.
                      {enrollment.pitch && (
                        <span className="block mt-1 italic">
                          Pitch: &ldquo;{enrollment.pitch}&rdquo;
                        </span>
                      )}
                    </p>
                  )}

                  {enrollment.status === "REJECTED" && (
                    <p className="text-sm text-destructive">
                      Your application was not approved.
                      {enrollment.revokeReason && (
                        <span className="block mt-1">
                          Reason: {enrollment.revokeReason}
                        </span>
                      )}
                    </p>
                  )}

                  {enrollment.status === "REVOKED" && (
                    <p className="text-sm text-destructive">
                      Your enrollment has been revoked.
                      {enrollment.revokeReason && (
                        <span className="block mt-1">
                          Reason: {enrollment.revokeReason}
                        </span>
                      )}
                    </p>
                  )}

                  {trackingUrl && isApproved && (
                    <div className="mt-4 rounded-md border bg-muted p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Tracking Link
                      </p>
                      <CopyTrackingLink url={trackingUrl} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
