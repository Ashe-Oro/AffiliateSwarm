import { prisma } from "@/lib/prisma";
import type { LeadStatus, HoldStatus, Prisma } from "@/generated/prisma/client";

/**
 * Unified status shown to advertisers on the CPA Conversions view.
 * Collapses Lead + EscrowHold state into the six values listed in issue #224.
 */
export type UnifiedConversionStatus =
  | "PENDING"
  | "HELD"
  | "MATURED"
  | "PAID"
  | "DISPUTED"
  | "REVERSED";

export interface UnifiedConversionRow {
  leadId: string;
  source: string;
  affiliateDisplayName: string;
  externalId: string | null;
  conversionDate: Date;
  payoutCents: number | null;
  unifiedStatus: UnifiedConversionStatus;
  rawLeadStatus: LeadStatus;
  rawHoldStatus: HoldStatus | null;
  maturityDate: Date | null;
  daysRemaining: number | null;
  canDispute: boolean;
}

export function deriveUnifiedStatus(
  leadStatus: LeadStatus,
  holdStatus: HoldStatus | null,
  releaseAt: Date | null,
  now: Date = new Date()
): UnifiedConversionStatus {
  if (leadStatus === "DISPUTED") return "DISPUTED";
  if (leadStatus === "REJECTED") return "REVERSED";
  if (leadStatus === "EXPIRED") return "REVERSED";

  if (leadStatus === "VERIFIED") {
    if (holdStatus === "RELEASED") return "PAID";
    if (holdStatus === "REFUNDED") return "REVERSED";
    if (holdStatus === "PENDING_RELEASE") {
      if (releaseAt && releaseAt.getTime() <= now.getTime()) return "MATURED";
      return "HELD";
    }
    return "HELD";
  }

  return "PENDING";
}

/**
 * Affiliate-facing unified conversion status (issue #227).
 * Narrower than the advertiser taxonomy because the affiliate only cares
 * about whether the payout is final (VERIFIED) vs. still at risk (PENDING).
 */
export type AffiliateConversionStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "REVERSED";

/**
 * Derive the affiliate-facing status from raw Lead + EscrowHold state.
 *
 * Key rule from issue #227: a conversion is NOT "verified" to the affiliate
 * while its escrow hold is still within the dispute window — it's "pending"
 * because the advertiser can still reverse it. Only once the hold has either
 * been released OR its releaseAt has elapsed (clock-authoritative, per
 * PR #237's pattern) does it transition to verified/final.
 */
export function deriveAffiliateStatus(
  leadStatus: LeadStatus,
  holdStatus: HoldStatus | null,
  releaseAt: Date | null,
  now: Date = new Date()
): AffiliateConversionStatus {
  if (leadStatus === "DISPUTED") return "REVERSED";
  if (leadStatus === "REJECTED") return "REJECTED";
  if (leadStatus === "EXPIRED") return "REVERSED";

  if (leadStatus === "VERIFIED") {
    if (holdStatus === "REFUNDED") return "REVERSED";
    if (holdStatus === "RELEASED") return "VERIFIED";
    if (holdStatus === "PENDING_RELEASE") {
      if (releaseAt && releaseAt.getTime() <= now.getTime()) return "VERIFIED";
      return "PENDING";
    }
    // HELD (pre-verification-release) or no hold yet → still pending from
    // the affiliate's perspective
    return "PENDING";
  }

  return "PENDING";
}

/**
 * Translate an affiliate-facing status filter into a Prisma WHERE clause
 * that joins Lead + EscrowHold. Mirrors `deriveAffiliateStatus` exactly so
 * filter results are consistent with the rendered status column.
 */
export function affiliateStatusFilterToWhere(
  filter: AffiliateConversionStatus,
  now: Date = new Date()
): Prisma.LeadWhereInput {
  switch (filter) {
    case "PENDING":
      return {
        OR: [
          { status: { in: ["SUBMITTED", "PENDING_VERIFICATION"] } },
          {
            status: "VERIFIED",
            OR: [
              { escrowHold: null },
              { escrowHold: { is: { status: "HELD" } } },
              {
                escrowHold: {
                  is: {
                    status: "PENDING_RELEASE",
                    releaseAt: { gt: now },
                  },
                },
              },
            ],
          },
        ],
      };
    case "VERIFIED":
      return {
        status: "VERIFIED",
        escrowHold: {
          is: {
            OR: [
              { status: "RELEASED" },
              { status: "PENDING_RELEASE", releaseAt: { lte: now } },
            ],
          },
        },
      };
    case "REJECTED":
      return { status: "REJECTED" };
    case "REVERSED":
      return {
        OR: [
          { status: "DISPUTED" },
          { status: "EXPIRED" },
          {
            status: "VERIFIED",
            escrowHold: { is: { status: "REFUNDED" } },
          },
        ],
      };
  }
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export interface ListAdvertiserConversionsInput {
  advertiserId: string;
  campaignId?: string;
  page: number;
  pageSize: number;
}

/**
 * Returns unified conversion rows for an advertiser's CPA campaigns.
 * Each row represents a Lead (the economic unit for CPA), joined with its
 * single EscrowHold to surface hold window + maturity date.
 */
export async function listAdvertiserConversions({
  advertiserId,
  campaignId,
  page,
  pageSize,
}: ListAdvertiserConversionsInput): Promise<{
  rows: UnifiedConversionRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const where = {
    campaign: {
      advertiserId,
      ...(campaignId ? { id: campaignId } : {}),
      compensationModel: "CPA" as const,
      deletedAt: null,
    },
  };

  const [leads, totalCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        affiliate: { select: { displayName: true } },
        campaign: { select: { id: true, name: true } },
        escrowHold: {
          select: {
            status: true,
            releaseAt: true,
            amountCents: true,
          },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const now = new Date();
  const rows: UnifiedConversionRow[] = leads.map((lead) => {
    const hold = lead.escrowHold;
    const unifiedStatus = deriveUnifiedStatus(
      lead.status,
      hold?.status ?? null,
      hold?.releaseAt ?? null,
      now
    );
    const daysRemaining =
      hold?.releaseAt && hold.status === "PENDING_RELEASE"
        ? daysBetween(now, hold.releaseAt)
        : null;

    return {
      leadId: lead.id,
      source: lead.externalId ?? lead.id.slice(0, 8),
      affiliateDisplayName: lead.affiliate.displayName,
      externalId: lead.externalId,
      conversionDate: lead.submittedAt,
      payoutCents: lead.payoutCents ?? hold?.amountCents ?? null,
      unifiedStatus,
      rawLeadStatus: lead.status,
      rawHoldStatus: hold?.status ?? null,
      maturityDate: hold?.releaseAt ?? null,
      daysRemaining,
      canDispute: unifiedStatus === "HELD",
    };
  });

  return { rows, totalCount, page, pageSize };
}
