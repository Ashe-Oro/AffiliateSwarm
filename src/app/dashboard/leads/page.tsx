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

export default async function DashboardLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;
  const params = await searchParams;

  const status =
    typeof params.status === "string" ? params.status : undefined;
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);

  const where: Prisma.LeadWhereInput = {
    campaign: { advertiserId: agentId },
    ...(status && { status: status as LeadStatus }),
  };

  const [leads, totalCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { campaign: true, affiliate: true },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/dashboard/leads${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">All Leads</h2>
        <div className="flex gap-1">
          {[
            { label: "All", value: "" },
            { label: "Pending", value: "SUBMITTED" },
            { label: "Verified", value: "VERIFIED" },
            { label: "Rejected", value: "REJECTED" },
            { label: "Disputed", value: "DISPUTED" },
          ].map((f) => (
            <Link
              key={f.value}
              href={`/dashboard/leads${f.value ? `?status=${f.value}` : ""}`}
            >
              <Button
                variant={
                  (status ?? "") === f.value ? "default" : "outline"
                }
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
              <TableHead>Campaign</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Payout</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    {lead.campaign.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {lead.externalId ?? lead.id.slice(0, 8)}
                  </TableCell>
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
                      compensationModel={lead.campaign.compensationModel}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} leads)
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
