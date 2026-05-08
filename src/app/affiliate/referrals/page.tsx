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
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAffiliateDashboardAuth } from "@/lib/auth/affiliate-dashboard";
import { ENABLE_AFFILIATE_REFERRALS_TAB } from "@/lib/feature-flags";
import { CreateReferralForm } from "@/components/affiliate/create-referral-form";

function statusVariant(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "default" as const;
    case "EXPIRED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function AffiliateReferralsPage() {
  if (!ENABLE_AFFILIATE_REFERRALS_TAB()) {
    notFound();
  }

  const { agent } = await requireAffiliateDashboardAuth();

  const referralsRaw = await prisma.referral.findMany({
    where: { affiliateId: agent.id },
    orderBy: { expiresAt: "desc" },
    take: 50,
  });

  // Fetch campaign names separately
  const refCampaignIds = [...new Set(referralsRaw.map((r) => r.campaignId))];
  const refCampaigns = await prisma.campaign.findMany({
    where: { id: { in: refCampaignIds } },
    select: { id: true, name: true },
  });
  const refCampaignMap = new Map(refCampaigns.map((c) => [c.id, c.name]));

  const referrals = referralsRaw.map((r) => ({
    ...r,
    campaignName: refCampaignMap.get(r.campaignId) ?? "Unknown",
  }));

  // Get campaigns this affiliate is enrolled in (for the create form)
  const enrollments = await prisma.affiliateEnrollment.findMany({
    where: { affiliateId: agent.id, status: "APPROVED" },
    include: {
      campaign: { select: { id: true, name: true, status: true } },
    },
  });

  const activeCampaigns = enrollments
    .filter((e) => e.campaign.status === "ACTIVE")
    .map((e) => ({ id: e.campaign.id, name: e.campaign.name }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Referrals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage referral tokens for your campaigns.
        </p>
      </div>

      {/* Create referral */}
      <Card>
        <CardHeader>
          <CardTitle>Create Referral Token</CardTitle>
          <CardDescription>
            Generate a signed referral token for a campaign you&apos;re enrolled
            in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You need to be enrolled in an active campaign to create referrals.
            </p>
          ) : (
            <CreateReferralForm campaigns={activeCampaigns} />
          )}
        </CardContent>
      </Card>

      {/* Referral list */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Your Referrals</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Confirmed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No referrals yet.
                  </TableCell>
                </TableRow>
              ) : (
                referrals.map((ref) => (
                  <TableRow key={ref.id}>
                    <TableCell className="font-medium">
                      {ref.campaignName}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {ref.token}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(ref.status)}>
                        {ref.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ref.expiresAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ref.confirmedAt
                        ? ref.confirmedAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "--"}
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
