export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
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
import { LeadActions } from "@/components/dashboard/lead-actions";
import type { Prisma, LeadStatus } from "@/generated/prisma/client";

const PAGE_SIZE = 25;

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

export default async function CampaignLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { campaignId } = await params;
  const sp = await searchParams;
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;

  const page = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, advertiserId: true, compensationModel: true },
  });

  if (!campaign || campaign.advertiserId !== agentId) {
    notFound();
  }

  const where: Prisma.LeadWhereInput = {
    campaignId,
    ...(statusFilter && { status: statusFilter as LeadStatus }),
  };

  const [leads, totalCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { affiliate: true },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const basePath = `/dashboard/campaigns/${campaignId}/leads`;

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (page > 1) params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (String(v) === "1" || !v) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
          <p className="text-sm text-muted-foreground">{campaign.name}</p>
        </div>
        <div className="flex gap-1">
          {[
            { label: "All", value: "" },
            { label: "Pending", value: "SUBMITTED" },
            { label: "Verified", value: "VERIFIED" },
            { label: "Rejected", value: "REJECTED" },
            { label: "Disputed", value: "DISPUTED" },
          ].map((f) => (
            <Link key={f.value} href={buildUrl({ status: f.value, page: "1" })}>
              <Button
                variant={(statusFilter ?? "") === f.value ? "default" : "outline"}
                size="sm"
              >
                {f.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No leads yet
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
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
                  <TableCell>
                    <LeadActions
                      leadId={lead.id}
                      status={lead.status}
                      compensationModel={campaign.compensationModel}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} leads)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: page - 1 })}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: page + 1 })}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
