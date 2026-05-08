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
import { ENABLE_AFFILIATE_REPUTATION_TAB } from "@/lib/feature-flags";

function tierVariant(tier: string) {
  switch (tier) {
    case "PREMIUM":
      return "default" as const;
    case "TRUSTED":
      return "default" as const;
    case "VERIFIED":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

interface DimensionScores {
  leadQuality?: number;
  conversionRate?: number;
  paymentReliability?: number;
  responseTime?: number;
  peerRating?: number;
}

export default async function AffiliateReputationPage() {
  if (!ENABLE_AFFILIATE_REPUTATION_TAB()) {
    notFound();
  }

  const { agent } = await requireAffiliateDashboardAuth();

  const reputation = await prisma.agentReputation.findUnique({
    where: { agentId: agent.id },
  });

  const ratings = await prisma.peerRating.findMany({
    where: { toAgentId: agent.id },
    include: {
      fromAgent: { select: { displayName: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const dimensions = (reputation?.dimensionScores as DimensionScores) ?? {};

  const dimensionList = [
    { label: "Lead Quality", value: dimensions.leadQuality, weight: "30%" },
    {
      label: "Conversion Rate",
      value: dimensions.conversionRate,
      weight: "25%",
    },
    {
      label: "Payment Reliability",
      value: dimensions.paymentReliability,
      weight: "20%",
    },
    { label: "Response Time", value: dimensions.responseTime, weight: "15%" },
    { label: "Peer Rating", value: dimensions.peerRating, weight: "10%" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reputation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your trust score and performance metrics.
        </p>
      </div>

      {!reputation ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No reputation data yet. Start promoting campaigns to build your
            score.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Trust Tier</CardDescription>
                <CardTitle>
                  <Badge
                    variant={tierVariant(reputation.trustTier)}
                    className="text-lg"
                  >
                    {reputation.trustTier}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Overall Score</CardDescription>
                <CardTitle className="text-3xl">
                  {reputation.overallScore}
                  <span className="text-lg text-muted-foreground">/100</span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Fraud Flags</CardDescription>
                <CardTitle className="text-3xl">
                  {reputation.fraudFlagCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Leads Submitted</CardDescription>
                <CardTitle className="text-2xl">
                  {reputation.totalLeadsSubmitted}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Leads Verified</CardDescription>
                <CardTitle className="text-2xl">
                  {reputation.totalLeadsVerified}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Leads Rejected</CardDescription>
                <CardTitle className="text-2xl">
                  {reputation.totalLeadsRejected}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Conversions</CardDescription>
                <CardTitle className="text-2xl">
                  {reputation.totalConversions}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Dimension Scores */}
          <Card>
            <CardHeader>
              <CardTitle>Dimension Scores</CardTitle>
              <CardDescription>
                Breakdown of your reputation across key performance areas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dimensionList.map((dim) => (
                  <div key={dim.label} className="flex items-center gap-4">
                    <div className="w-40 text-sm text-muted-foreground">
                      {dim.label}
                      <span className="ml-1 text-xs">({dim.weight})</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${dim.value ?? 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-right text-sm font-medium">
                      {dim.value ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Peer Ratings */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Peer Ratings</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ratings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No peer ratings yet.
                  </TableCell>
                </TableRow>
              ) : (
                ratings.map((rating) => (
                  <TableRow key={rating.id}>
                    <TableCell className="font-medium">
                      {rating.fromAgent.displayName}
                    </TableCell>
                    <TableCell>{rating.campaign.name}</TableCell>
                    <TableCell className="text-center font-medium">
                      {rating.score}/5
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {rating.comment ?? "--"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rating.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
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
