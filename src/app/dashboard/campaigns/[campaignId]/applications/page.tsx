export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
import { ApplicationActions } from "@/components/dashboard/application-actions";

function statusVariant(status: string) {
  switch (status) {
    case "APPROVED":
      return "default" as const;
    case "REJECTED":
    case "REVOKED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function CampaignApplicationsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { advertiserAgent } = await requireDashboardAuth();
  const agentId = advertiserAgent.id;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, advertiserId: true },
  });

  if (!campaign || campaign.advertiserId !== agentId) {
    notFound();
  }

  const applications = await prisma.affiliateEnrollment.findMany({
    where: { campaignId },
    include: { affiliate: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Applications</h2>
        <p className="text-sm text-muted-foreground">{campaign.name}</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affiliate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pitch</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No applications yet
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    {app.affiliate.displayName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(app.status)}>
                      {app.status.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {app.pitch ?? "--"}
                  </TableCell>
                  <TableCell>
                    {app.enrolledAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <ApplicationActions
                      campaignId={campaignId}
                      applicationId={app.id}
                      status={app.status}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
