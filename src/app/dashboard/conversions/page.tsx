export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
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
import { ConversionsTable } from "@/components/dashboard/conversions-table";
import { listAdvertiserConversions } from "@/services/conversions.service";

const PAGE_SIZE = 25;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusVariant(status: string) {
  switch (status) {
    case "VERIFIED":
    case "ATTRIBUTED":
      return "default" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function ConversionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;
  const params = await searchParams;
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const campaignIdFilter =
    typeof params.campaignId === "string" ? params.campaignId : undefined;

  const campaigns = await prisma.campaign.findMany({
    where: { advertiserId: agentId, deletedAt: null },
    select: { id: true, name: true, compensationModel: true },
  });
  const cpaCampaignIds = new Set(
    campaigns.filter((c) => c.compensationModel === "CPA").map((c) => c.id)
  );
  const hasCpa = cpaCampaignIds.size > 0;
  const nonCpaIds = campaigns
    .filter((c) => c.compensationModel !== "CPA")
    .map((c) => c.id);
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));

  // Unified CPA conversions (the advertiser-facing source of truth)
  const cpaResult = hasCpa
    ? await listAdvertiserConversions({
        advertiserId: agentId,
        campaignId: campaignIdFilter,
        page,
        pageSize: PAGE_SIZE,
      })
    : { rows: [], totalCount: 0, page, pageSize: PAGE_SIZE };

  // Legacy ConversionEvent rows for non-CPA campaigns (unchanged view)
  const legacyCampaignIds = campaignIdFilter
    ? nonCpaIds.filter((id) => id === campaignIdFilter)
    : nonCpaIds;
  const legacyWhere = { campaignId: { in: legacyCampaignIds } };
  const [legacyConversions, legacyCount, legacyStats] =
    legacyCampaignIds.length > 0
      ? await Promise.all([
          prisma.conversionEvent.findMany({
            where: legacyWhere,
            include: { affiliate: { select: { displayName: true } } },
            orderBy: { occurredAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          }),
          prisma.conversionEvent.count({ where: legacyWhere }),
          prisma.conversionEvent.groupBy({
            by: ["status"],
            where: legacyWhere,
            _count: true,
            _sum: { revenueCents: true },
          }),
        ])
      : [[], 0, []];

  // Build lead → campaign map for the CPA table's optional campaign column
  const leadCampaignMap = new Map<string, string>();
  if (hasCpa && cpaResult.rows.length > 0) {
    const leadIds = cpaResult.rows.map((r) => r.leadId);
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, campaignId: true },
    });
    for (const lead of leads) {
      const name = campaignMap.get(lead.campaignId);
      if (name) leadCampaignMap.set(lead.id, name);
    }
  }

  const totalPages = Math.ceil(
    (hasCpa ? cpaResult.totalCount : legacyCount) / PAGE_SIZE
  );
  const totalRevenue = legacyStats.reduce(
    (sum, s) => sum + (s._sum.revenueCents ?? 0),
    0
  );
  const legacyTotalCount = legacyStats.reduce((sum, s) => sum + s._count, 0);
  const legacyVerifiedCount =
    legacyStats.find((s) => s.status === "VERIFIED")?._count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Conversions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversion events across your campaigns.
        </p>
      </div>

      {hasCpa && (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold">CPA Conversions</h3>
            <p className="text-sm text-muted-foreground">
              Source of truth for CPA campaigns. Each row is a billable
              conversion — dispute during the hold window; once matured, the
              dispute is rejected by the backend.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total (CPA)</CardDescription>
                <CardTitle className="text-3xl">
                  {cpaResult.totalCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>In Hold Window</CardDescription>
                <CardTitle className="text-3xl">
                  {cpaResult.rows.filter((r) => r.unifiedStatus === "HELD").length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Paid</CardDescription>
                <CardTitle className="text-3xl">
                  {cpaResult.rows.filter((r) => r.unifiedStatus === "PAID").length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          <ConversionsTable
            rows={cpaResult.rows}
            emptyLabel="No CPA conversions yet"
            showCampaignColumn
            leadCampaignMap={leadCampaignMap}
          />
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({cpaResult.totalCount} conversions)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/dashboard/conversions?page=${page - 1}${campaignIdFilter ? `&campaignId=${campaignIdFilter}` : ""}`}
                  >
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/dashboard/conversions?page=${page + 1}${campaignIdFilter ? `&campaignId=${campaignIdFilter}` : ""}`}
                  >
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {legacyCampaignIds.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold">Other Campaigns</h3>
            <p className="text-sm text-muted-foreground">
              Conversion events for non-CPA campaigns.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total</CardDescription>
                <CardTitle className="text-3xl">{legacyTotalCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Verified</CardDescription>
                <CardTitle className="text-3xl">{legacyVerifiedCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Revenue</CardDescription>
                <CardTitle className="text-3xl">
                  {formatCents(totalRevenue)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {legacyConversions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No conversion events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  legacyConversions.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell className="font-medium">
                        {campaignMap.get(conv.campaignId) ?? "Unknown"}
                      </TableCell>
                      <TableCell>{conv.affiliate.displayName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {conv.actionType.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(conv.status)}>
                          {conv.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {conv.revenueCents != null
                          ? formatCents(conv.revenueCents)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        {conv.payoutCents != null
                          ? formatCents(conv.payoutCents)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {conv.occurredAt.toLocaleDateString("en-US", {
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
        </section>
      )}

      {!hasCpa && legacyCampaignIds.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any campaigns yet.
        </p>
      )}
    </div>
  );
}
