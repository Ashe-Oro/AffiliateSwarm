// ---------------------------------------------------------------------------
// Canonical notification event catalog
// ---------------------------------------------------------------------------

// -- Application lifecycle --------------------------------------------------

export interface ApplicationSubmittedEvent {
  type: "application.submitted";
  data: {
    campaignId: string;
    affiliateId: string;
    enrollmentId: string;
    campaignName: string;
    affiliateName: string;
  };
}

export interface ApplicationApprovedEvent {
  type: "application.approved";
  data: {
    campaignId: string;
    affiliateId: string;
    enrollmentId: string;
    campaignName: string;
    affiliateName: string;
    trackingCode?: string;
    trackingUrl?: string;
  };
}

export interface ApplicationRejectedEvent {
  type: "application.rejected";
  data: {
    campaignId: string;
    affiliateId: string;
    enrollmentId: string;
    campaignName: string;
    affiliateName: string;
    reason?: string;
  };
}

// -- Campaign lifecycle -----------------------------------------------------

export interface CampaignCreatedEvent {
  type: "campaign.created";
  data: {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
  };
}

export interface CampaignFundedEvent {
  type: "campaign.funded";
  data: {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
    amountCents: number;
    platformFeeCents?: number;
    source: "stripe_card" | "stripe_ach" | "onchain" | "allocation";
  };
}

export interface CampaignTrackingConfirmedEvent {
  type: "campaign.tracking_confirmed";
  data: {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
  };
}

export interface CampaignActivatedEvent {
  type: "campaign.activated";
  data: {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
  };
}

export interface CampaignPausedEvent {
  type: "campaign.paused";
  data: {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
  };
}

export interface CampaignResumedEvent {
  type: "campaign.resumed";
  data: {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
  };
}

export interface CampaignBudgetLowEvent {
  type: "campaign.budget_low";
  data: {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
    remainingCents: number;
    budgetCents: number;
    percentRemaining: number;
  };
}

export interface CampaignOversubscribedEvent {
  type: "campaign.oversubscribed";
  data: {
    advertiserId: string;
    activeBudgetHeadroomCents: number;
    walletAvailableCents: number;
    shortfallCents: number;
    activeCampaignCount: number;
  };
}

// -- Lead lifecycle ---------------------------------------------------------

export interface LeadSubmittedEvent {
  type: "lead.submitted";
  data: {
    leadId: string;
    campaignId: string;
    affiliateId?: string;
  };
}

export interface LeadVerifiedEvent {
  type: "lead.verified";
  data: {
    leadId: string;
    campaignId: string;
    campaignName: string;
    affiliateId: string;
    advertiserId: string;
    payoutCents: number;
  };
}

export interface LeadRejectedEvent {
  type: "lead.rejected";
  data: {
    leadId: string;
    campaignId: string;
    campaignName: string;
    affiliateId: string;
    advertiserId: string;
    reason?: string;
  };
}

export interface LeadDisputedEvent {
  type: "lead.disputed";
  data: {
    leadId: string;
    campaignId: string;
    campaignName: string;
    affiliateId: string;
    advertiserId: string;
    reason: string;
    payoutCents: number;
  };
}

// -- Tracking / attribution -------------------------------------------------

export interface ClickTrackedEvent {
  type: "click.tracked";
  data: {
    trackingCode: string;
    campaignId: string;
    affiliateId: string;
  };
}

export interface PostbackReceivedEvent {
  type: "postback.received";
  data: {
    leadId: string;
    campaignId: string;
    affiliateId: string;
    externalId?: string;
  };
}

export interface ReferralCreatedEvent {
  type: "referral.created";
  data: {
    referralId: string;
    campaignId: string;
    affiliateId: string;
  };
}

export interface ReferralConfirmedEvent {
  type: "referral.confirmed";
  data: {
    referralId: string;
    leadId: string;
    campaignId: string;
    campaignName: string;
    affiliateId: string;
    advertiserId: string;
    payoutCents: number;
  };
}

export interface ConversionTrackedEvent {
  type: "conversion.tracked";
  data: {
    conversionId: string;
    campaignId: string;
    affiliateId?: string;
  };
}

export interface ConversionFundingFailedEvent {
  type: "conversion.funding_failed";
  data: {
    leadId: string;
    campaignId: string;
    campaignName: string;
    advertiserId: string;
    affiliateId: string;
    payoutCents: number;
    reason: "wallet_empty" | "budget_exhausted";
  };
}

// -- Deposit ----------------------------------------------------------------

export interface DepositConfirmedEvent {
  type: "deposit.confirmed";
  data: {
    chainTransactionId: string;
    agentId: string;
    walletId: string;
    amountCents: number;
    txHash: string;
  };
}

// -- Earnings lifecycle -----------------------------------------------------

export interface EarningsPendingReleaseEvent {
  type: "earnings.pending_release";
  data: {
    affiliateId: string;
    campaignId: string;
    campaignName: string;
    amountCents: number;
    releaseDate: string; // ISO date
  };
}

export interface EarningsAvailableEvent {
  type: "earnings.available";
  data: {
    affiliateId: string;
    campaignId: string;
    campaignName: string;
    amountCents: number;
  };
}

// -- Payout lifecycle -------------------------------------------------------

export interface PayoutRequestedEvent {
  type: "payout.requested";
  data: {
    payoutRequestId: string;
    affiliateId: string;
    amountCents: number;
    method: string;
  };
}

export interface PayoutProcessingEvent {
  type: "payout.processing";
  data: {
    payoutRequestId: string;
    affiliateId: string;
    amountCents: number;
    method: string;
  };
}

export interface PayoutCompletedEvent {
  type: "payout.completed";
  data: {
    payoutRequestId: string;
    affiliateId: string;
    amountCents: number;
    txHash?: string;
    chainAddress?: string;
  };
}

export interface PayoutFailedEvent {
  type: "payout.failed";
  data: {
    payoutRequestId: string;
    affiliateId: string;
    amountCents: number;
    reason?: string;
  };
}

export interface PayoutCancelledEvent {
  type: "payout.cancelled";
  data: {
    payoutRequestId: string;
    affiliateId: string;
    amountCents: number;
  };
}

export interface PayoutRejectedEvent {
  type: "payout.rejected";
  data: {
    payoutRequestId: string;
    affiliateId: string;
    amountCents: number;
    reason?: string;
  };
}

// -- Union type -------------------------------------------------------------

export type NotificationEvent =
  | ApplicationSubmittedEvent
  | ApplicationApprovedEvent
  | ApplicationRejectedEvent
  | CampaignCreatedEvent
  | CampaignFundedEvent
  | CampaignTrackingConfirmedEvent
  | CampaignActivatedEvent
  | CampaignPausedEvent
  | CampaignResumedEvent
  | CampaignBudgetLowEvent
  | CampaignOversubscribedEvent
  | LeadSubmittedEvent
  | LeadVerifiedEvent
  | LeadRejectedEvent
  | LeadDisputedEvent
  | ClickTrackedEvent
  | PostbackReceivedEvent
  | ReferralCreatedEvent
  | ReferralConfirmedEvent
  | ConversionTrackedEvent
  | ConversionFundingFailedEvent
  | DepositConfirmedEvent
  | EarningsPendingReleaseEvent
  | EarningsAvailableEvent
  | PayoutRequestedEvent
  | PayoutProcessingEvent
  | PayoutCompletedEvent
  | PayoutFailedEvent
  | PayoutCancelledEvent
  | PayoutRejectedEvent;

// -- Event config -----------------------------------------------------------

export type RecipientTarget = "advertiser" | "affiliate" | "both" | "none";

export interface EventConfig {
  email: boolean;
  webhook: boolean;
  recipients: RecipientTarget;
}

export const EVENT_CONFIG: Record<NotificationEvent["type"], EventConfig> = {
  // Application lifecycle
  "application.submitted":       { email: true,  webhook: true,  recipients: "advertiser" },
  "application.approved":        { email: true,  webhook: true,  recipients: "affiliate" },
  "application.rejected":        { email: true,  webhook: true,  recipients: "affiliate" },

  // Campaign lifecycle
  "campaign.created":            { email: true,  webhook: true,  recipients: "advertiser" },
  "campaign.funded":             { email: true,  webhook: true,  recipients: "advertiser" },
  "campaign.tracking_confirmed": { email: true,  webhook: true,  recipients: "advertiser" },
  "campaign.activated":          { email: true,  webhook: true,  recipients: "advertiser" },
  "campaign.paused":             { email: false, webhook: true,  recipients: "advertiser" },
  "campaign.resumed":            { email: false, webhook: true,  recipients: "advertiser" },
  "campaign.budget_low":         { email: true,  webhook: true,  recipients: "advertiser" },
  "campaign.oversubscribed":     { email: true,  webhook: true,  recipients: "advertiser" },

  // Lead lifecycle
  "lead.submitted":              { email: false, webhook: true,  recipients: "none" },
  "lead.verified":               { email: true,  webhook: true,  recipients: "both" },
  "lead.rejected":               { email: true,  webhook: true,  recipients: "both" },
  "lead.disputed":               { email: true,  webhook: true,  recipients: "both" },

  // Tracking / attribution
  "click.tracked":               { email: false, webhook: true,  recipients: "none" },
  "postback.received":           { email: true,  webhook: true,  recipients: "both" },
  "referral.created":            { email: false, webhook: true,  recipients: "none" },
  "referral.confirmed":          { email: true,  webhook: true,  recipients: "both" },
  "conversion.tracked":          { email: false, webhook: true,  recipients: "none" },
  "conversion.funding_failed":   { email: true,  webhook: true,  recipients: "both" },

  // Deposit
  "deposit.confirmed":           { email: false, webhook: true,  recipients: "none" },

  // Earnings lifecycle
  "earnings.pending_release":    { email: true,  webhook: true,  recipients: "affiliate" },
  "earnings.available":          { email: true,  webhook: true,  recipients: "affiliate" },

  // Payout lifecycle
  "payout.requested":            { email: true,  webhook: true,  recipients: "affiliate" },
  "payout.processing":           { email: false, webhook: true,  recipients: "affiliate" },
  "payout.completed":            { email: true,  webhook: true,  recipients: "affiliate" },
  "payout.failed":               { email: true,  webhook: true,  recipients: "affiliate" },
  "payout.cancelled":            { email: true,  webhook: true,  recipients: "affiliate" },
  "payout.rejected":             { email: true,  webhook: true,  recipients: "affiliate" },
};

// -- Aggregate mapping for dedup --------------------------------------------

export function getAggregateInfo(event: NotificationEvent): {
  aggregateType: string;
  aggregateId: string;
} {
  switch (event.type) {
    case "application.submitted":
    case "application.approved":
    case "application.rejected":
      return { aggregateType: "Enrollment", aggregateId: event.data.enrollmentId };

    case "campaign.created":
    case "campaign.funded":
    case "campaign.tracking_confirmed":
    case "campaign.activated":
    case "campaign.paused":
    case "campaign.resumed":
      return { aggregateType: "Campaign", aggregateId: event.data.campaignId };

    case "campaign.budget_low":
      return { aggregateType: "Campaign", aggregateId: `${event.data.campaignId}:budget_low` };

    case "campaign.oversubscribed":
      return { aggregateType: "Advertiser", aggregateId: `${event.data.advertiserId}:oversubscribed` };

    case "lead.submitted":
    case "lead.verified":
    case "lead.rejected":
    case "lead.disputed":
      return { aggregateType: "Lead", aggregateId: event.data.leadId };

    case "click.tracked":
      return { aggregateType: "Click", aggregateId: event.data.trackingCode };

    case "postback.received":
      return { aggregateType: "Lead", aggregateId: event.data.leadId };

    case "referral.created":
    case "referral.confirmed":
      return { aggregateType: "Referral", aggregateId: event.data.referralId };

    case "conversion.tracked":
      return { aggregateType: "Conversion", aggregateId: event.data.conversionId };

    case "conversion.funding_failed":
      return { aggregateType: "Lead", aggregateId: `${event.data.leadId}:funding_failed` };

    case "deposit.confirmed":
      return { aggregateType: "ChainTransaction", aggregateId: event.data.chainTransactionId };

    case "earnings.pending_release":
    case "earnings.available":
      return { aggregateType: "Earnings", aggregateId: `${event.data.affiliateId}:${event.data.campaignId}` };

    case "payout.requested":
    case "payout.processing":
    case "payout.completed":
    case "payout.failed":
    case "payout.cancelled":
    case "payout.rejected":
      return { aggregateType: "Payout", aggregateId: event.data.payoutRequestId };
  }
}
