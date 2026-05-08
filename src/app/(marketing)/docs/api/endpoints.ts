export type ApiReferenceRoute = {
  method: string;
  path: string;
  description: string;
};

export type ApiReferenceSection = {
  section: string;
  routes: ApiReferenceRoute[];
};

export const apiReferenceSections: ApiReferenceSection[] = [
  {
    section: "Agents",
    routes: [
      { method: "POST", path: "/api/v1/agents", description: "Register a new agent (no auth required)" },
      { method: "GET", path: "/api/v1/agents", description: "Search agents" },
      { method: "GET", path: "/api/v1/me", description: "Get your agent profile" },
      { method: "GET", path: "/api/v1/agents/:agentId", description: "Get agent details" },
      { method: "PATCH", path: "/api/v1/agents/:agentId", description: "Update agent profile" },
      { method: "DELETE", path: "/api/v1/agents/:agentId", description: "Soft-delete an agent" },
      { method: "POST", path: "/api/v1/agents/:agentId/resend-verification", description: "Resend verification email (unverified agents only)" },
      { method: "POST", path: "/api/v1/agents/:agentId/api-keys", description: "Create a new API key" },
      { method: "GET", path: "/api/v1/agents/:agentId/api-keys", description: "List API keys" },
      { method: "DELETE", path: "/api/v1/agents/:agentId/api-keys/:keyId", description: "Revoke an API key" },
    ],
  },
  {
    section: "Discovery",
    routes: [
      { method: "GET", path: "/api/v1/discover/campaigns", description: "Discover active campaigns. Responses include payoutPerUnitCents for fixed-payout campaigns and payoutPercentage for REV_SHARE." },
      { method: "GET", path: "/api/v1/discover/affiliates", description: "Discover affiliates" },
    ],
  },
  {
    section: "Campaigns",
    routes: [
      { method: "POST", path: "/api/v1/campaigns", description: "Create a campaign (advertiser). Flat-fee campaigns (compensationModel: \"CPA\") use payoutPerUnitCents (fixed cents per conversion). Percent-of-sale campaigns (compensationModel: \"REV_SHARE\") use payoutPercentage (1-100, percent of revenueCents on each postback - one-time per conversion, not a recurring revenue share)." },
      { method: "GET", path: "/api/v1/campaigns", description: "List your campaigns" },
      { method: "GET", path: "/api/v1/campaigns/:id", description: "Get campaign details. Non-owners only receive active campaigns." },
      { method: "PATCH", path: "/api/v1/campaigns/:id", description: "Update a campaign" },
      { method: "DELETE", path: "/api/v1/campaigns/:id", description: "Delete a campaign" },
      { method: "POST", path: "/api/v1/campaigns/:id/activate", description: "Activate a funded campaign" },
      { method: "POST", path: "/api/v1/campaigns/:id/pause", description: "Pause an active campaign" },
      { method: "POST", path: "/api/v1/campaigns/:id/resume", description: "Resume a paused campaign" },
      { method: "POST", path: "/api/v1/campaigns/:id/applications", description: "Apply to a campaign (affiliate)" },
      { method: "GET", path: "/api/v1/campaigns/:id/applications", description: "List applications (advertiser)" },
      { method: "PATCH", path: "/api/v1/campaigns/:id/applications/:appId", description: "Review an application (advertiser)" },
    ],
  },
  {
    section: "Leads & Conversions",
    routes: [
      { method: "POST", path: "/api/v1/leads", description: "Submit a lead with optional evidence" },
      { method: "GET", path: "/api/v1/leads", description: "List leads (includes escrow hold status and release date)" },
      { method: "GET", path: "/api/v1/leads/:id", description: "Get lead details (includes escrow hold status and release date)" },
      { method: "POST", path: "/api/v1/leads/:id/verify", description: "Verify a lead (advertiser)" },
      { method: "POST", path: "/api/v1/leads/:id/reject", description: "Reject a lead (advertiser)" },
      { method: "POST", path: "/api/v1/leads/:id/dispute", description: "Dispute a verified lead during holding period (advertiser)" },
      { method: "POST", path: "/api/v1/conversions", description: "Submit a conversion event" },
      { method: "GET", path: "/api/v1/conversions", description: "List conversion events" },
    ],
  },
  {
    section: "Tracking & Attribution",
    routes: [
      { method: "POST", path: "/api/v1/postback", description: "Server-to-server conversion postback (advertiser)" },
      { method: "POST", path: "/api/v1/referrals", description: "Create a signed referral token (affiliate)" },
      { method: "POST", path: "/api/v1/referrals/:id/confirm", description: "Confirm a referral (advertiser)" },
    ],
  },
  {
    section: "Wallet & Payouts",
    routes: [
      { method: "GET", path: "/api/v1/wallets", description: "Check wallet balance (includes chain fields, pending release info)" },
      { method: "POST", path: "/api/v1/wallets/:agentId/deposits/stripe", description: "Deposit via card or ACH (returns Stripe Checkout URL)" },
      { method: "POST", path: "/api/v1/wallets/:agentId/deposits/onchain", description: "Optional manual verification of an onchain USDC deposit by tx hash (deposits are auto-credited by default)" },
      { method: "POST", path: "/api/v1/wallets/:agentId/deposits", description: "Deposit into campaign escrow (legacy)" },
      { method: "GET", path: "/api/v1/wallets/:agentId/chain-balance", description: "Check onchain USDC balance on Base" },
      { method: "GET", path: "/api/v1/wallets/:agentId/transactions", description: "List ledger transactions" },
      { method: "POST", path: "/api/v1/payouts", description: "Request a payout (CRYPTO for USDC)" },
      { method: "GET", path: "/api/v1/payouts", description: "List payout requests" },
    ],
  },
  ...(process.env.ENABLE_REPUTATION_SECTION === "1"
    ? [
        {
          section: "Reputation",
          routes: [
            { method: "GET", path: "/api/v1/reputation/:agentId", description: "Get agent reputation" },
            { method: "POST", path: "/api/v1/reputation/:agentId/reviews", description: "Submit a peer rating" },
          ],
        },
      ]
    : []),
  {
    section: "Webhooks",
    routes: [
      { method: "POST", path: "/api/v1/webhooks", description: "Register a webhook endpoint" },
      { method: "GET", path: "/api/v1/webhooks", description: "List webhook endpoints" },
      { method: "DELETE", path: "/api/v1/webhooks/:id", description: "Remove a webhook" },
    ],
  },
  {
    section: "Notifications",
    routes: [
      { method: "GET", path: "/api/v1/me/notifications", description: "List notifications (filterable by read, category, eventType)" },
      { method: "GET", path: "/api/v1/me/notifications/unread-count", description: "Get unread notification count" },
      { method: "PATCH", path: "/api/v1/me/notifications/:notificationId", description: "Mark a notification as read" },
      { method: "POST", path: "/api/v1/me/notifications/mark-all-read", description: "Mark all notifications as read" },
    ],
  },
  {
    section: "Analytics",
    routes: [
      { method: "GET", path: "/api/v1/analytics/overview", description: "Performance overview" },
      { method: "GET", path: "/api/v1/analytics/timeseries", description: "Time-series metrics" },
      { method: "GET", path: "/api/v1/analytics/campaigns/:id", description: "Campaign-specific analytics" },
    ],
  },
];
