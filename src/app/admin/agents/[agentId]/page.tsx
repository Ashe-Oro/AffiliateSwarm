export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
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
import { formatCents } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";
import { addressUrl } from "@/lib/chain/explorer";
import { AdminAgentActions } from "@/components/admin/agent-actions";

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "SUSPENDED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function campaignStatusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "PAUSED":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function enrollmentStatusVariant(status: string) {
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

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function emailStatusBadge({
  sentAt,
  lastAttemptAt,
  lastError,
}: {
  sentAt: Date | null | undefined;
  lastAttemptAt: Date | null | undefined;
  lastError: string | null | undefined;
}): { variant: "default" | "destructive" | "secondary" | "outline"; label: string } {
  if (sentAt) return { variant: "default", label: "Sent" };
  if (lastError) return { variant: "destructive", label: "Failed" };
  if (lastAttemptAt) return { variant: "secondary", label: "Pending" };
  return { variant: "outline", label: "Not attempted" };
}

function EmailStatusRow({
  label,
  sentAt,
  lastAttemptAt,
  lastError,
  action,
}: {
  label: string;
  sentAt: Date | null | undefined;
  lastAttemptAt: Date | null | undefined;
  lastError: string | null | undefined;
  action: React.ReactNode;
}) {
  const statusBadge = emailStatusBadge({ sentAt, lastAttemptAt, lastError });

  return (
    <div className="space-y-2 rounded-md border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{label}</h4>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
        {action}
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Last sent</dt>
          <dd className="font-medium">{formatDateTime(sentAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last attempt</dt>
          <dd className="font-medium">{formatDateTime(lastAttemptAt)}</dd>
        </div>
        {lastError && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Last error</dt>
            <dd className="font-medium text-destructive">{lastError}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <a
        href={addressUrl(address)}
        target="_blank"
        rel="noreferrer"
        className="font-mono break-all underline"
      >
        {address}
      </a>
      <CopyButton
        text={address}
        variant="ghost"
        size="icon-xs"
        label=""
        copiedLabel=""
        className="h-5 w-5 shrink-0 p-0"
      />
    </div>
  );
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

// ---------------------------------------------------------------------------
// Advertiser-specific data fetching
// ---------------------------------------------------------------------------
async function fetchAdvertiserData(agentId: string) {
  const [
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    verifiedLeads,
    pendingLeads,
    campaigns,
    recentLeads,
  ] = await Promise.all([
    prisma.campaign.count({ where: { advertiserId: agentId } }),
    prisma.campaign.count({
      where: { advertiserId: agentId, status: "ACTIVE" },
    }),
    prisma.lead.count({
      where: { campaign: { advertiserId: agentId } },
    }),
    prisma.lead.count({
      where: { campaign: { advertiserId: agentId }, status: "VERIFIED" },
    }),
    prisma.lead.count({
      where: {
        campaign: { advertiserId: agentId },
        status: { in: ["SUBMITTED", "PENDING_VERIFICATION"] },
      },
    }),
    prisma.campaign.findMany({
      where: { advertiserId: agentId },
      include: { _count: { select: { leads: true, enrollments: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({
      where: { campaign: { advertiserId: agentId } },
      include: { campaign: true, affiliate: true },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    verifiedLeads,
    pendingLeads,
    campaigns,
    recentLeads,
  };
}

// ---------------------------------------------------------------------------
// Affiliate-specific data fetching
// ---------------------------------------------------------------------------
async function fetchAffiliateData(agentId: string) {
  const enrollments = await prisma.affiliateEnrollment.findMany({
    where: { affiliateId: agentId },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
  });

  const [activeCampaigns, totalClicks, totalLeads, verifiedLeads, earningsAgg, recentLeads] =
    await Promise.all([
      prisma.affiliateEnrollment.count({
        where: { affiliateId: agentId, status: "APPROVED" },
      }),
      prisma.clickEvent.count({
        where: { affiliateId: agentId },
      }),
      prisma.lead.count({
        where: { affiliateId: agentId },
      }),
      prisma.lead.count({
        where: { affiliateId: agentId, status: "VERIFIED" },
      }),
      prisma.lead.aggregate({
        where: { affiliateId: agentId, status: "VERIFIED" },
        _sum: { payoutCents: true },
      }),
      prisma.lead.findMany({
        where: { affiliateId: agentId },
        include: { campaign: true },
        orderBy: { submittedAt: "desc" },
        take: 10,
      }),
    ]);

  const approvedEnrollments = enrollments.filter((e) => e.status === "APPROVED");
  const enrollmentStats = await Promise.all(
    approvedEnrollments.map(async (enrollment) => {
      const [clicks, leads, verified, earnings] = await Promise.all([
        prisma.clickEvent.count({
          where: { affiliateId: agentId, campaignId: enrollment.campaignId },
        }),
        prisma.lead.count({
          where: { affiliateId: agentId, campaignId: enrollment.campaignId },
        }),
        prisma.lead.count({
          where: { affiliateId: agentId, campaignId: enrollment.campaignId, status: "VERIFIED" },
        }),
        prisma.lead.aggregate({
          where: { affiliateId: agentId, campaignId: enrollment.campaignId, status: "VERIFIED" },
          _sum: { payoutCents: true },
        }),
      ]);
      return {
        enrollmentId: enrollment.id,
        clicks,
        leads,
        verified,
        earnings: earnings._sum.payoutCents ?? 0,
      };
    })
  );
  const statsMap = new Map(enrollmentStats.map((s) => [s.enrollmentId, s]));

  return {
    enrollments,
    activeCampaigns,
    totalClicks,
    totalLeads,
    verifiedLeads,
    totalEarnings: earningsAgg._sum.payoutCents ?? 0,
    recentLeads,
    statsMap,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function AdminAgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      reputation: true,
      wallet: true,
      ownerUser: { select: { email: true } },
    },
  });

  if (!agent) {
    notFound();
  }

  const isAdvertiser = agent.type === "ADVERTISER" || agent.type === "DUAL";
  const isAffiliate = agent.type === "AFFILIATE" || agent.type === "DUAL";

  const [advertiserData, affiliateData] = await Promise.all([
    isAdvertiser ? fetchAdvertiserData(agentId) : null,
    isAffiliate ? fetchAffiliateData(agentId) : null,
  ]);

  const email = agent.email ?? agent.ownerUser?.email ?? "--";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/admin/agents"
          className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to agents
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            {agent.displayName}
          </h2>
          <Badge variant={statusVariant(agent.status)}>
            {agent.status.toLowerCase().replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {agent.type.toLowerCase()}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {agent.verificationLevel.toLowerCase().replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {/* Advertiser KPIs */}
      {advertiserData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Campaigns</CardDescription>
              <CardTitle className="text-3xl">
                {advertiserData.totalCampaigns.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {advertiserData.activeCampaigns} active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-3xl">
                {advertiserData.totalLeads.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {advertiserData.verifiedLeads} verified, {advertiserData.pendingLeads} pending
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Wallet Balance</CardDescription>
              <CardTitle className="text-3xl">
                {formatCents(agent.wallet?.availableCents ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Available balance</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payout</CardDescription>
              <CardTitle className="text-3xl">
                {formatCents(agent.wallet?.pendingPayoutCents ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </CardContent>
          </Card>
        </div>
      )}

      {agent.wallet &&
        (agent.wallet.chainAddress || agent.wallet.depositAddress) && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Wallet Addresses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {agent.wallet.chainAddress && (
                <AddressRow
                  label={
                    agent.wallet.walletType === "BYOW"
                      ? "Receiving (BYOW)"
                      : "Chain"
                  }
                  address={agent.wallet.chainAddress}
                />
              )}
              {agent.wallet.depositAddress &&
                agent.wallet.depositAddress !== agent.wallet.chainAddress && (
                  <AddressRow
                    label="Deposit"
                    address={agent.wallet.depositAddress}
                  />
                )}
            </CardContent>
          </Card>
        )}

      {/* Affiliate KPIs */}
      {affiliateData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {isAdvertiser ? "Enrolled Campaigns" : "Active Campaigns"}
              </CardDescription>
              <CardTitle className="text-3xl">
                {affiliateData.activeCampaigns.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {affiliateData.enrollments.length} total enrollment
                {affiliateData.enrollments.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Clicks</CardDescription>
              <CardTitle className="text-3xl">
                {affiliateData.totalClicks.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Across all tracking links</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {isAdvertiser ? "Affiliate Leads" : "Total Leads"}
              </CardDescription>
              <CardTitle className="text-3xl">
                {affiliateData.totalLeads.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {affiliateData.verifiedLeads} verified
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Earnings</CardDescription>
              <CardTitle className="text-3xl">
                {formatCents(affiliateData.totalEarnings)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {formatCents(agent.wallet?.availableCents ?? 0)} available
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Details */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium capitalize">
                {agent.type.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">
                {agent.status.toLowerCase().replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Verification Level</dt>
              <dd className="font-medium capitalize">
                {agent.verificationLevel.toLowerCase().replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Trust Tier</dt>
              <dd className="font-medium capitalize">
                {agent.reputation?.trustTier
                  ?.toLowerCase()
                  .replace(/_/g, " ") ?? "unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="font-medium">
                {agent.createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
            {agent.websiteUrl && (
              <div>
                <dt className="text-muted-foreground">Website</dt>
                <dd className="truncate font-medium">{agent.websiteUrl}</dd>
              </div>
            )}
            {agent.description && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="font-medium">{agent.description}</dd>
              </div>
            )}
            {agent.audienceSize != null && (
              <div>
                <dt className="text-muted-foreground">Audience Size</dt>
                <dd className="font-medium">
                  {agent.audienceSize.toLocaleString()}
                </dd>
              </div>
            )}
            {agent.channels.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Channels</dt>
                <dd className="font-medium">{agent.channels.join(", ")}</dd>
              </div>
            )}
            {agent.contentType && (
              <div>
                <dt className="text-muted-foreground">Content Type</dt>
                <dd className="font-medium">{agent.contentType}</dd>
              </div>
            )}
            {agent.audienceGeo && (
              <div>
                <dt className="text-muted-foreground">Audience Geo</dt>
                <dd className="font-medium">{agent.audienceGeo}</dd>
              </div>
            )}
            {agent.relevantUrls.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Relevant URLs</dt>
                <dd className="font-medium">
                  {agent.relevantUrls.join(", ")}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Email Status */}
      <Card>
        <CardHeader>
          <CardTitle>Email status</CardTitle>
          <CardDescription>
            Last-known outcome of each transactional email sent to this agent.
            Use the resend buttons to retry manually if delivery failed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <EmailStatusRow
            label="Verification email"
            sentAt={agent.verificationEmailSentAt}
            lastAttemptAt={agent.verificationEmailLastAttemptAt}
            lastError={agent.verificationEmailLastError}
            action={
              <AdminAgentActions
                agentId={agent.id}
                status={agent.status}
                verificationLevel={agent.verificationLevel}
                canResendVerification={Boolean(agent.email ?? agent.ownerUser?.email)}
                mode="verification"
              />
            }
          />
          <EmailStatusRow
            label="Welcome email"
            sentAt={agent.onboardingEmailSentAt}
            lastAttemptAt={agent.onboardingEmailLastAttemptAt}
            lastError={agent.onboardingEmailLastError}
            action={
              <AdminAgentActions
                agentId={agent.id}
                status={agent.status}
                verificationLevel={agent.verificationLevel}
                canResendVerification={Boolean(agent.email ?? agent.ownerUser?.email)}
                mode="onboarding"
              />
            }
          />
        </CardContent>
      </Card>

      {/* Advertiser: Campaigns Owned */}
      {advertiserData && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Campaigns</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Affiliates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advertiserData.campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No campaigns created
                    </TableCell>
                  </TableRow>
                ) : (
                  advertiserData.campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="hover:underline"
                        >
                          {campaign.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={campaignStatusVariant(campaign.status)}>
                          {campaign.status.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{campaign.compensationModel}</TableCell>
                      <TableCell className="text-right">
                        {formatCents(campaign.budgetCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign._count.leads.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign._count.enrollments.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Advertiser: Recent Leads (shows affiliate name) */}
      {advertiserData && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">
            Recent Leads{isAffiliate ? " (as Advertiser)" : ""}
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advertiserData.recentLeads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No leads yet
                    </TableCell>
                  </TableRow>
                ) : (
                  advertiserData.recentLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.campaign.name}
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

      {/* Affiliate: Campaign Enrollments */}
      {affiliateData && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">
            Campaign Enrollments{isAdvertiser ? " (as Affiliate)" : ""}
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliateData.enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No campaign enrollments
                    </TableCell>
                  </TableRow>
                ) : (
                  affiliateData.enrollments.map((enrollment) => {
                    const s = affiliateData.statsMap.get(enrollment.id);
                    return (
                      <TableRow key={enrollment.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/campaigns/${enrollment.campaignId}`}
                            className="hover:underline"
                          >
                            {enrollment.campaign.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={enrollmentStatusVariant(enrollment.status)}
                          >
                            {enrollment.status.toLowerCase().replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {s ? s.clicks.toLocaleString() : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {s ? s.leads.toLocaleString() : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {s ? s.verified.toLocaleString() : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {s ? formatCents(s.earnings) : "--"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Affiliate: Recent Leads (shows campaign name) */}
      {affiliateData && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">
            Recent Leads{isAdvertiser ? " (as Affiliate)" : ""}
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliateData.recentLeads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No leads yet
                    </TableCell>
                  </TableRow>
                ) : (
                  affiliateData.recentLeads.map((lead) => (
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
