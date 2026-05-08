import type { NotificationCategory } from "@/generated/prisma/client";
import type { NotificationEvent } from "./events";
import type { NotificationRecipient } from "./recipients";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderedNotification {
  title: string;
  summary: string;
  category: NotificationCategory;
  resourceType: string | null;
  resourceId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<string, NotificationCategory> = {
  application: "APPLICATIONS",
  campaign: "CAMPAIGNS",
  lead: "LEADS",
  postback: "TRACKING",
  referral: "TRACKING",
  conversion: "LEADS",
  earnings: "EARNINGS",
  payout: "PAYOUTS",
};

function getCategory(eventType: string): NotificationCategory {
  const prefix = eventType.split(".")[0];
  return CATEGORY_MAP[prefix] ?? "CAMPAIGNS";
}

// ---------------------------------------------------------------------------
// Resource mapping
// ---------------------------------------------------------------------------

function getResource(event: NotificationEvent): { type: string | null; id: string | null } {
  switch (event.type) {
    case "application.submitted":
    case "application.approved":
    case "application.rejected":
      return { type: "Enrollment", id: event.data.enrollmentId };

    case "campaign.created":
    case "campaign.funded":
    case "campaign.tracking_confirmed":
    case "campaign.activated":
    case "campaign.paused":
    case "campaign.resumed":
    case "campaign.budget_low":
      return { type: "Campaign", id: event.data.campaignId };

    case "campaign.oversubscribed":
      return { type: "Wallet", id: event.data.advertiserId };

    case "conversion.funding_failed":
      return { type: "Lead", id: event.data.leadId };

    case "lead.submitted":
    case "lead.verified":
    case "lead.rejected":
    case "lead.disputed":
      return { type: "Lead", id: event.data.leadId };

    case "postback.received":
      return { type: "Lead", id: event.data.leadId };

    case "referral.confirmed":
      return { type: "Referral", id: event.data.referralId };

    case "earnings.pending_release":
    case "earnings.available":
      return { type: "Campaign", id: event.data.campaignId };

    case "payout.requested":
    case "payout.processing":
    case "payout.completed":
    case "payout.failed":
    case "payout.cancelled":
    case "payout.rejected":
      return { type: "Payout", id: event.data.payoutRequestId };

    default:
      return { type: null, id: null };
  }
}

// ---------------------------------------------------------------------------
// Content renderers (role-aware)
// ---------------------------------------------------------------------------

type ContentRenderer<T extends NotificationEvent = NotificationEvent> = (
  event: T,
  recipient: NotificationRecipient
) => { title: string; summary: string } | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RENDERERS: Partial<Record<NotificationEvent["type"], ContentRenderer<any>>> = {
  // -- Application lifecycle ------------------------------------------------

  "application.submitted": (event) => ({
    title: `New application from ${event.data.affiliateName}`,
    summary: `${event.data.affiliateName} applied to ${event.data.campaignName}`,
  }),

  "application.approved": (event) => ({
    title: "Application approved",
    summary: `You were approved for ${event.data.campaignName}`,
  }),

  "application.rejected": (event) => ({
    title: "Application not approved",
    summary: `Your application for ${event.data.campaignName} was declined`,
  }),

  // -- Campaign lifecycle ---------------------------------------------------

  "campaign.created": (event) => ({
    title: "Campaign created",
    summary: `${event.data.campaignName} has been created as a draft`,
  }),

  "campaign.funded": (event) => ({
    title: "Funds received",
    summary: `${formatCents(event.data.amountCents)} deposited to ${event.data.campaignName}`,
  }),

  "campaign.tracking_confirmed": (event) => ({
    title: "Tracking confirmed",
    summary: `Tracking configured for ${event.data.campaignName}`,
  }),

  "campaign.activated": (event) => ({
    title: "Campaign is live",
    summary: `${event.data.campaignName} is now active`,
  }),

  "campaign.paused": (event) => ({
    title: "Campaign paused",
    summary: `${event.data.campaignName} has been paused`,
  }),

  "campaign.resumed": (event) => ({
    title: "Campaign resumed",
    summary: `${event.data.campaignName} is active again`,
  }),

  "campaign.budget_low": (event) => ({
    title: "Low budget warning",
    summary: `${event.data.campaignName} has ${event.data.percentRemaining}% budget remaining`,
  }),

  "campaign.oversubscribed": (event) => ({
    title: "Wallet oversubscribed",
    summary: `Active campaigns need ${formatCents(event.data.shortfallCents)} more than your wallet has`,
  }),

  "conversion.funding_failed": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        title: "Conversion unpaid — insufficient advertiser funds",
        summary: `${formatCents(event.data.payoutCents)} from ${event.data.campaignName} could not be paid out`,
      };
    }
    return {
      title: "Conversion failed to pay",
      summary: `${formatCents(event.data.payoutCents)} on ${event.data.campaignName} — ${event.data.reason === "budget_exhausted" ? "campaign budget cap reached" : "wallet too low"}`,
    };
  },

  // -- Lead lifecycle -------------------------------------------------------

  "lead.verified": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        title: "Conversion verified",
        summary: `You earned ${formatCents(event.data.payoutCents)} from ${event.data.campaignName}`,
      };
    }
    return {
      title: "Lead verified",
      summary: `A lead for ${event.data.campaignName} was verified`,
    };
  },

  "lead.rejected": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        title: "Conversion rejected",
        summary: `A conversion for ${event.data.campaignName} was rejected`,
      };
    }
    return {
      title: "Lead rejected",
      summary: `A lead for ${event.data.campaignName} was rejected`,
    };
  },

  "lead.disputed": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        title: "Commission reversed",
        summary: `${formatCents(event.data.payoutCents)} reversed for ${event.data.campaignName}`,
      };
    }
    return {
      title: "Lead disputed",
      summary: `A lead for ${event.data.campaignName} was disputed`,
    };
  },

  // -- Tracking / attribution -----------------------------------------------

  "postback.received": () => ({
    title: "Postback conversion",
    summary: "Server-to-server conversion confirmed",
  }),

  "referral.confirmed": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        title: "Referral confirmed",
        summary: `You earned ${formatCents(event.data.payoutCents)} from ${event.data.campaignName}`,
      };
    }
    return {
      title: "Referral confirmed",
      summary: `A referral for ${event.data.campaignName} was confirmed`,
    };
  },

  // -- Earnings lifecycle ---------------------------------------------------

  "earnings.pending_release": (event) => ({
    title: "Earnings in holding",
    summary: `${formatCents(event.data.amountCents)} from ${event.data.campaignName} available on ${event.data.releaseDate}`,
  }),

  "earnings.available": (event) => ({
    title: "Earnings available",
    summary: `${formatCents(event.data.amountCents)} from ${event.data.campaignName} is now available`,
  }),

  // -- Payout lifecycle -----------------------------------------------------

  "payout.requested": (event) => ({
    title: "Payout requested",
    summary: `Payout of ${formatCents(event.data.amountCents)} via ${event.data.method} submitted`,
  }),

  "payout.processing": (event) => ({
    title: "Payout processing",
    summary: `Your ${formatCents(event.data.amountCents)} payout is being processed`,
  }),

  "payout.completed": (event) => ({
    title: "Payout complete",
    summary: `Your payout of ${formatCents(event.data.amountCents)} has been sent`,
  }),

  "payout.failed": (event) => ({
    title: "Payout failed",
    summary: `Your ${formatCents(event.data.amountCents)} payout could not be completed`,
  }),

  "payout.cancelled": (event) => ({
    title: "Payout cancelled",
    summary: `Your ${formatCents(event.data.amountCents)} payout was cancelled`,
  }),

  "payout.rejected": (event) => ({
    title: "Payout rejected",
    summary: `Your ${formatCents(event.data.amountCents)} payout was rejected`,
  }),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderNotification(
  event: NotificationEvent,
  recipient: NotificationRecipient
): RenderedNotification | null {
  const renderer = RENDERERS[event.type];
  if (!renderer) return null;

  const content = renderer(event as never, recipient);
  if (!content) return null;

  const resource = getResource(event);

  return {
    title: content.title,
    summary: content.summary,
    category: getCategory(event.type),
    resourceType: resource.type,
    resourceId: resource.id,
  };
}
