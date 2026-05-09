export const dynamic = "force-dynamic";

import { Suspense } from "react";
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
import { prisma } from "@/lib/prisma";
import { requireAffiliateDashboardAuth } from "@/lib/auth/affiliate-dashboard";
import { DiscoverFilters } from "@/components/affiliate/discover-filters";
import { ApplyToCampaign } from "@/components/affiliate/apply-to-campaign";
import type { Prisma, CompensationModelType } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPayout(
  model: string,
  payoutPerUnitCents: number | null,
  payoutPercentage: number | null
): string {
  if (model === "REV_SHARE") {
    if (payoutPercentage == null) return "percent of sale";
    return `${payoutPercentage}% of initial sale`;
  }
  if (payoutPerUnitCents == null) return "—";
  return `${formatCents(payoutPerUnitCents)} per conversion`;
}

function compensationBadgeLabel(model: string): string {
  switch (model) {
    case "CPL":
      return "Cost per Lead";
    case "CPA":
      return "Flat fee";
    case "CPC":
      return "Cost per Click";
    case "REV_SHARE":
      return "Percent of sale";
    default:
      return model;
  }
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

type FundingHealth = "healthy" | "low" | "at_risk";

/**
 * Bucket a campaign's payout runway into a tri-state signal for affiliates.
 * Runway = current escrow balance + whatever the advertiser's shared wallet
 * can still contribute under this campaign's remaining budget cap.
 */
function computeFundingHealth(
  estimatedPayoutCents: number,
  escrowBalanceCents: number,
  walletAvailableCents: number,
  budgetHeadroomCents: number
): FundingHealth {
  const walletContribution = Math.max(
    0,
    Math.min(walletAvailableCents, budgetHeadroomCents)
  );
  const runwayCents = escrowBalanceCents + walletContribution;
  const perConversionCents = Math.max(estimatedPayoutCents, 1);
  if (runwayCents >= perConversionCents * 10) return "healthy";
  if (runwayCents >= perConversionCents) return "low";
  return "at_risk";
}

function fundingHealthBadge(health: FundingHealth) {
  switch (health) {
    case "healthy":
      return {
        label: "well funded",
        className:
          "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
      };
    case "low":
      return {
        label: "funds low",
        className:
          "border-[var(--v2-accent-2)] bg-[var(--v2-lime-muted)] text-[var(--v2-text)]",
      };
    case "at_risk":
      return {
        label: "funds at risk",
        className:
          "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
      };
  }
}

export default async function DiscoverCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agent } = await requireAffiliateDashboardAuth();
  const params = await searchParams;

  const query = typeof params.q === "string" ? params.q : undefined;
  const compensationModel =
    typeof params.compensationModel === "string"
      ? params.compensationModel
      : undefined;
  const category =
    typeof params.category === "string" ? params.category : undefined;
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);

  // Build filter
  const where: Prisma.CampaignWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    ...(compensationModel && {
      compensationModel: compensationModel as CompensationModelType,
    }),
    ...(category && { categories: { has: category } }),
    ...(query && { name: { contains: query, mode: "insensitive" as const } }),
  };

  // Parallel: campaigns, count, enrollments, and all categories for the filter
  const [campaigns, totalCount, enrollments, allCategories] = await Promise.all(
    [
      prisma.campaign.findMany({
        where,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          compensationModel: true,
          payoutPerUnitCents: true,
          payoutPercentage: true,
          currency: true,
          geoTargets: true,
          categories: true,
          enrollmentPolicy: true,
          createdAt: true,
          budgetCents: true,
          escrowAccount: {
            select: { currentBalanceCents: true, totalDepositedCents: true },
          },
          advertiser: {
            select: {
              id: true,
              displayName: true,
              wallet: { select: { availableCents: true } },
            },
          },
        },
      }),
      prisma.campaign.count({ where }),
      prisma.affiliateEnrollment.findMany({
        where: { affiliateId: agent.id },
        select: { campaignId: true, status: true },
      }),
      prisma.campaign
        .findMany({
          where: { status: "ACTIVE", deletedAt: null },
          select: { categories: true },
        })
        .then((rows) => {
          const set = new Set<string>();
          for (const r of rows) {
            for (const c of r.categories) set.add(c);
          }
          return Array.from(set).sort();
        }),
    ]
  );

  const enrollmentMap = new Map(
    enrollments.map((e) => [e.campaignId, e.status])
  );
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Build pagination query string helper
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (compensationModel) params.set("compensationModel", compensationModel);
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/affiliate/discover${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Discover Campaigns
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse active campaigns and apply to promote them.
        </p>
      </div>

      <Suspense>
        <DiscoverFilters categories={allCategories} />
      </Suspense>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No campaigns found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const existingStatus = enrollmentMap.get(campaign.id);
            const escrowBalance =
              campaign.escrowAccount?.currentBalanceCents ?? 0;
            const totalDeposited =
              campaign.escrowAccount?.totalDepositedCents ?? 0;
            const walletAvailable =
              campaign.advertiser.wallet?.availableCents ?? 0;
            const budgetHeadroom = Math.max(
              0,
              campaign.budgetCents - totalDeposited
            );
            // For REV_SHARE we don't know the per-conversion payout upfront; use
            // a nominal $1 so funding-health rules don't falsely flag healthy
            // campaigns as "at risk" just because payoutPercentage isn't a cents value.
            const estimatedPayoutCents =
              campaign.compensationModel === "REV_SHARE"
                ? 100
                : (campaign.payoutPerUnitCents ?? 0);
            const fundingHealth = computeFundingHealth(
              estimatedPayoutCents,
              escrowBalance,
              walletAvailable,
              budgetHeadroom
            );
            const fundingBadge = fundingHealthBadge(fundingHealth);

            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <CardDescription className="mt-1">
                        by {campaign.advertiser.displayName} &middot;{" "}
                        {formatPayout(
                          campaign.compensationModel,
                          campaign.payoutPerUnitCents,
                          campaign.payoutPercentage
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">
                        {compensationBadgeLabel(campaign.compensationModel)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={fundingBadge.className}
                      >
                        {fundingBadge.label}
                      </Badge>
                      {campaign.enrollmentPolicy === "OPEN" && (
                        <Badge variant="secondary">auto-approve</Badge>
                      )}
                      {campaign.enrollmentPolicy === "INVITE_ONLY" && (
                        <Badge variant="destructive">invite only</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {campaign.description && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {campaign.description}
                    </p>
                  )}

                  {/* Geo targets & categories */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {campaign.geoTargets.map((geo) => (
                      <Badge key={geo} variant="outline" className="text-xs">
                        {geo}
                      </Badge>
                    ))}
                    {campaign.categories.map((cat) => (
                      <Badge key={cat} variant="outline" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>

                  {/* Action: show enrollment status or apply button */}
                  {existingStatus ? (
                    <div className="flex items-center gap-2">
                      <Badge variant={enrollmentStatusVariant(existingStatus)}>
                        {existingStatus.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {existingStatus === "APPROVED"
                          ? "You're enrolled in this campaign."
                          : existingStatus === "PENDING"
                            ? "Your application is pending review."
                            : existingStatus === "REJECTED"
                              ? "Your application was not approved."
                              : "Your enrollment was revoked."}
                      </span>
                    </div>
                  ) : campaign.enrollmentPolicy === "INVITE_ONLY" ? (
                    <p className="text-sm text-muted-foreground">
                      This campaign is invite-only.
                    </p>
                  ) : (
                    <ApplyToCampaign
                      campaignId={campaign.id}
                      enrollmentPolicy={campaign.enrollmentPolicy}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} campaigns)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageUrl(page - 1)}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(page + 1)}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
