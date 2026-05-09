import type { NotificationEvent } from "./events";
import type { NotificationRecipient } from "./recipients";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function renderEmail(
  event: NotificationEvent,
  recipient: NotificationRecipient
): RenderedEmail | null {
  const renderer = RENDERERS[event.type];
  if (!renderer) return null;
  return renderer(event as never, recipient);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function wrap(body: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #18181b;">
${body}
<p style="margin-top: 32px; color: #71717a; font-size: 13px;">
— The AffiliateSwarm team<br/>
<a href="${APP_URL}">${APP_URL}</a>
</p>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// Template renderers
// ---------------------------------------------------------------------------

type Renderer<T extends NotificationEvent = NotificationEvent> = (
  event: T,
  recipient: NotificationRecipient
) => RenderedEmail | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RENDERERS: Partial<Record<NotificationEvent["type"], Renderer<any>>> = {
  // -- Application lifecycle ------------------------------------------------

  "application.submitted": (event, _recipient) => ({
    subject: `New affiliate application for ${event.data.campaignName}`,
    html: wrap(`
<h2>New affiliate application</h2>
<p>Hi ${_recipient.displayName},</p>
<p><strong>${event.data.affiliateName}</strong> has applied to join your campaign <strong>${event.data.campaignName}</strong>.</p>
<p>Review the application in your <a href="${APP_URL}/dashboard">AffiliateSwarm dashboard</a> to approve or reject it.</p>
    `),
  }),

  "application.approved": (event, recipient) => ({
    subject: `You were approved for ${event.data.campaignName}`,
    html: wrap(`
<h2>Application approved</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your application for <strong>${event.data.campaignName}</strong> was approved.</p>
${event.data.trackingUrl ? `<p>Your tracking link is ready: <a href="${event.data.trackingUrl}">${event.data.trackingUrl}</a></p>` : ""}
<p>Start promoting and earning commissions!</p>
    `),
  }),

  "application.rejected": (event, recipient) => ({
    subject: `Your application for ${event.data.campaignName} was not approved`,
    html: wrap(`
<h2>Application not approved</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your application for <strong>${event.data.campaignName}</strong> was declined.</p>
${event.data.reason ? `<p>Reason: ${event.data.reason}</p>` : ""}
<p>You can continue exploring other campaigns in <a href="${APP_URL}/dashboard">AffiliateSwarm</a>.</p>
    `),
  }),

  // -- Campaign lifecycle ---------------------------------------------------

  "campaign.created": (event, recipient) => ({
    subject: `Campaign created: ${event.data.campaignName}`,
    html: wrap(`
<h2>Campaign created</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your campaign <strong>${event.data.campaignName}</strong> has been created as a draft.</p>
<p>Next steps: fund your campaign, confirm tracking, then activate it to start receiving affiliate applications.</p>
<p><a href="${APP_URL}/dashboard">Go to dashboard</a></p>
    `),
  }),

  "campaign.funded": (event, recipient) => ({
    subject: `Funds received for ${event.data.campaignName}`,
    html: wrap(`
<h2>Campaign funded</h2>
<p>Hi ${recipient.displayName},</p>
<p>We received <strong>${formatCents(event.data.amountCents)}</strong> for <strong>${event.data.campaignName}</strong>.</p>
<p>Your campaign escrow has been updated.</p>
    `),
  }),

  "campaign.tracking_confirmed": (event, recipient) => ({
    subject: `Tracking confirmed for ${event.data.campaignName}`,
    html: wrap(`
<h2>Tracking confirmed</h2>
<p>Hi ${recipient.displayName},</p>
<p>Tracking for <strong>${event.data.campaignName}</strong> has been marked as configured.</p>
<p>You can activate the campaign once funding is in place.</p>
    `),
  }),

  "campaign.activated": (event, recipient) => ({
    subject: `Campaign is live: ${event.data.campaignName}`,
    html: wrap(`
<h2>Campaign activated</h2>
<p>Hi ${recipient.displayName},</p>
<p><strong>${event.data.campaignName}</strong> is now active and discoverable by affiliates.</p>
    `),
  }),

  "campaign.budget_low": (event, recipient) => ({
    subject: `Low balance warning: ${event.data.campaignName}`,
    html: wrap(`
<h2>Campaign balance is low</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your campaign <strong>${event.data.campaignName}</strong> has <strong>${formatCents(event.data.remainingCents)}</strong> remaining (${event.data.percentRemaining}% of budget).</p>
<p>Add funds in your <a href="${APP_URL}/dashboard">dashboard</a> to keep it running.</p>
    `),
  }),

  "campaign.oversubscribed": (event, recipient) => ({
    subject: `Heads up: your active campaign budgets exceed your wallet balance`,
    html: wrap(`
<h2>Wallet is oversubscribed</h2>
<p>Hi ${recipient.displayName},</p>
<p>You have <strong>${event.data.activeCampaignCount}</strong> active campaign${event.data.activeCampaignCount === 1 ? "" : "s"} with a combined remaining budget of <strong>${formatCents(event.data.activeBudgetHeadroomCents)}</strong>, but your wallet only has <strong>${formatCents(event.data.walletAvailableCents)}</strong> available. That's a shortfall of <strong>${formatCents(event.data.shortfallCents)}</strong>.</p>
<p>Campaigns auto-draw from your wallet as conversions come in (first-come-first-served). If the wallet runs dry, valid conversions on any of your active campaigns can fail until you top up.</p>
<p><a href="${APP_URL}/dashboard">Top up your wallet</a> to guarantee coverage.</p>
    `),
  }),

  // -- Lead lifecycle -------------------------------------------------------

  "lead.verified": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        subject: `You earned from ${event.data.campaignName}`,
        html: wrap(`
<h2>Conversion verified</h2>
<p>Hi ${recipient.displayName},</p>
<p>A conversion for <strong>${event.data.campaignName}</strong> was verified.</p>
<p>Gross payout: <strong>${formatCents(event.data.payoutCents)}</strong></p>
        `),
      };
    }
    return {
      subject: `Lead verified for ${event.data.campaignName}`,
      html: wrap(`
<h2>Lead verified</h2>
<p>Hi ${recipient.displayName},</p>
<p>A lead for <strong>${event.data.campaignName}</strong> has been verified and the affiliate has been paid.</p>
      `),
    };
  },

  "lead.rejected": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        subject: `Conversion rejected for ${event.data.campaignName}`,
        html: wrap(`
<h2>Conversion rejected</h2>
<p>Hi ${recipient.displayName},</p>
<p>A conversion for <strong>${event.data.campaignName}</strong> was rejected.</p>
${event.data.reason ? `<p>Reason: ${event.data.reason}</p>` : ""}
        `),
      };
    }
    return {
      subject: `Lead rejected for ${event.data.campaignName}`,
      html: wrap(`
<h2>Lead rejected</h2>
<p>Hi ${recipient.displayName},</p>
<p>A lead for <strong>${event.data.campaignName}</strong> has been rejected.</p>
${event.data.reason ? `<p>Reason: ${event.data.reason}</p>` : ""}
      `),
    };
  },

  "lead.disputed": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        subject: `Commission reversed for ${event.data.campaignName}`,
        html: wrap(`
<h2>Commission reversed</h2>
<p>Hi ${recipient.displayName},</p>
<p>A verified conversion for <strong>${event.data.campaignName}</strong> was reversed by the advertiser during the holding period.</p>
<p>Amount: <strong>${formatCents(event.data.payoutCents)}</strong></p>
${event.data.reason ? `<p>Reason: ${event.data.reason}</p>` : ""}
<p>This change applies to that individual lead commission only. Your payout requests remain separate withdrawal records.</p>
<p>The held funds have been returned to the campaign escrow. If you believe this reversal is in error, please contact the advertiser directly.</p>
        `),
      };
    }
    return {
      subject: `Lead disputed for ${event.data.campaignName}`,
      html: wrap(`
<h2>Lead disputed</h2>
<p>Hi ${recipient.displayName},</p>
<p>You disputed a lead for <strong>${event.data.campaignName}</strong>.</p>
<p>Amount refunded: <strong>${formatCents(event.data.payoutCents)}</strong></p>
${event.data.reason ? `<p>Reason: ${event.data.reason}</p>` : ""}
<p>The escrowed funds have been returned to your campaign balance.</p>
      `),
    };
  },

  "conversion.funding_failed": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        subject: `Conversion unpaid: ${event.data.campaignName} is out of funds`,
        html: wrap(`
<h2>A conversion could not be paid out</h2>
<p>Hi ${recipient.displayName},</p>
<p>A valid conversion you drove for <strong>${event.data.campaignName}</strong> (payout <strong>${formatCents(event.data.payoutCents)}</strong>) could not be paid out. The advertiser's wallet${event.data.reason === "budget_exhausted" ? " or campaign budget" : ""} is currently insufficient to cover it.</p>
<p>You may want to pause traffic on this campaign until the advertiser tops up. We'll retry automatically on future conversions once funds are available.</p>
<p><a href="${APP_URL}/affiliate/discover">Review this campaign</a></p>
        `),
      };
    }
    return {
      subject: `Conversion failed to pay: ${event.data.campaignName}`,
      html: wrap(`
<h2>Insufficient funds for a conversion</h2>
<p>Hi ${recipient.displayName},</p>
<p>A conversion on <strong>${event.data.campaignName}</strong> worth <strong>${formatCents(event.data.payoutCents)}</strong> could not be paid out. Reason: <strong>${event.data.reason === "budget_exhausted" ? "campaign budget cap reached" : "wallet balance too low"}</strong>.</p>
<p>Affiliates on this campaign have been notified and may pause traffic. <a href="${APP_URL}/dashboard">Top up your wallet</a> to restore payouts.</p>
      `),
    };
  },

  "postback.received": (event, recipient) => ({
    subject: `Conversion confirmed via postback`,
    html: wrap(`
<h2>Postback conversion</h2>
<p>Hi ${recipient.displayName},</p>
<p>A server-to-server conversion was confirmed for campaign <strong>${event.data.campaignId}</strong>.</p>
    `),
  }),

  "referral.confirmed": (event, recipient) => {
    if (recipient.role === "affiliate") {
      return {
        subject: `Referral confirmed for ${event.data.campaignName}`,
        html: wrap(`
<h2>Referral confirmed</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your referral for <strong>${event.data.campaignName}</strong> was confirmed.</p>
<p>Gross payout: <strong>${formatCents(event.data.payoutCents)}</strong></p>
        `),
      };
    }
    return {
      subject: `Referral confirmed for ${event.data.campaignName}`,
      html: wrap(`
<h2>Referral confirmed</h2>
<p>Hi ${recipient.displayName},</p>
<p>A referral for <strong>${event.data.campaignName}</strong> has been confirmed and the affiliate has been paid.</p>
      `),
    };
  },

  // -- Earnings lifecycle ---------------------------------------------------

  "earnings.pending_release": (event, recipient) => ({
    subject: `Earnings recorded for ${event.data.campaignName}`,
    html: wrap(`
<h2>Earnings in holding period</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your conversion for <strong>${event.data.campaignName}</strong> was verified, but the payout of <strong>${formatCents(event.data.amountCents)}</strong> is in the holding period until <strong>${event.data.releaseDate}</strong>.</p>
<p>We'll notify you when the funds become available.</p>
    `),
  }),

  "earnings.available": (event, recipient) => ({
    subject: `Your earnings are now available`,
    html: wrap(`
<h2>Earnings available</h2>
<p>Hi ${recipient.displayName},</p>
<p><strong>${formatCents(event.data.amountCents)}</strong> from <strong>${event.data.campaignName}</strong> is now available in your AffiliateSwarm wallet.</p>
<p>You can keep the balance in-platform or <a href="${APP_URL}/dashboard">request a payout</a>.</p>
    `),
  }),

  // -- Payout lifecycle -----------------------------------------------------

  "payout.requested": (event, recipient) => ({
    subject: `Payout request received`,
    html: wrap(`
<h2>Payout requested</h2>
<p>Hi ${recipient.displayName},</p>
<p>We received your payout request for <strong>${formatCents(event.data.amountCents)}</strong> via ${event.data.method}.</p>
<p>We'll notify you when it completes or if action is required.</p>
    `),
  }),

  "payout.completed": (event, recipient) => ({
    subject: `Your payout is complete`,
    html: wrap(`
<h2>Payout complete</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your payout of <strong>${formatCents(event.data.amountCents)}</strong> has been completed.</p>
${event.data.txHash ? `<p>Transaction: <code>${event.data.txHash}</code></p>` : ""}
    `),
  }),

  "payout.failed": (event, recipient) => ({
    subject: `There was a problem with your payout`,
    html: wrap(`
<h2>Payout failed</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your payout of <strong>${formatCents(event.data.amountCents)}</strong> could not be completed.</p>
${event.data.reason ? `<p>Reason: ${event.data.reason}</p>` : ""}
<p>If applicable, the funds have been returned to your wallet.</p>
    `),
  }),

  "payout.cancelled": (event, recipient) => ({
    subject: `Payout cancelled`,
    html: wrap(`
<h2>Payout cancelled</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your payout of <strong>${formatCents(event.data.amountCents)}</strong> has been cancelled. The funds are back in your wallet.</p>
    `),
  }),

  "payout.rejected": (event, recipient) => ({
    subject: `Payout rejected`,
    html: wrap(`
<h2>Payout rejected</h2>
<p>Hi ${recipient.displayName},</p>
<p>Your payout of <strong>${formatCents(event.data.amountCents)}</strong> was rejected.</p>
${event.data.reason ? `<p>Reason: ${event.data.reason}</p>` : ""}
<p>The funds have been returned to your wallet.</p>
    `),
  }),
};
