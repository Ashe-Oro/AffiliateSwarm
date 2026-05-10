# Email Notifications Reference

Complete catalog of every email AffiliateSwarm sends, organized by category.

---

## Standalone Transactional Emails

These are sent directly via dedicated functions, outside the event notification system.

| #   | Email              | Subject                                                  | Recipient   | Trigger                           |
| --- | ------------------ | -------------------------------------------------------- | ----------- | --------------------------------- |
| 1   | Verify Email       | "Verify your email address"                              | New agent   | Agent registers with an email     |
| 2   | Login Code         | "Your AffiliateSwarm login code: {CODE}"                        | Agent       | Agent requests email login code   |
| 3   | Partner Welcome    | "Welcome to AffiliateSwarm, {NAME} — here's your referral code" | New partner | Partner record is created         |
| 4   | Onboarding Welcome | "Welcome to AffiliateSwarm — you're registered as {TYPE}"       | Agent       | After email verification succeeds |

---

## Event-Driven Emails

These are sent through the notification event system with configurable triggers. Each event can also fire a webhook.

### Application Lifecycle

| #   | Event                   | Subject                                            | Recipient  | Trigger                                                            |
| --- | ----------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| 5   | `application.submitted` | "New affiliate application for {CAMPAIGN}"         | Advertiser | Affiliate applies to a non-OPEN campaign                           |
| 6   | `application.approved`  | "You were approved for {CAMPAIGN}"                 | Affiliate  | Auto-approved (OPEN enrollment) or manually approved by advertiser |
| 7   | `application.rejected`  | "Your application for {CAMPAIGN} was not approved" | Affiliate  | Advertiser rejects application                                     |

### Campaign Lifecycle

| #   | Event                         | Subject                             | Recipient  | Trigger                                         |
| --- | ----------------------------- | ----------------------------------- | ---------- | ----------------------------------------------- |
| 8   | `campaign.created`            | "Campaign created: {CAMPAIGN}"      | Advertiser | New campaign created                            |
| 9   | `campaign.funded`             | "Funds received for {CAMPAIGN}"     | Advertiser | Deposit via USDC or wallet allocation           |
| 10  | `campaign.tracking_confirmed` | "Tracking confirmed for {CAMPAIGN}" | Advertiser | Advertiser confirms tracking setup              |
| 11  | `campaign.activated`          | "Campaign is live: {CAMPAIGN}"      | Advertiser | Campaign goes live                              |
| 12  | `campaign.paused`             | —                                   | —          | Email disabled (webhook only)                   |
| 13  | `campaign.resumed`            | —                                   | —          | Email disabled (webhook only)                   |
| 14  | `campaign.budget_low`         | "Low balance warning: {CAMPAIGN}"   | Advertiser | Escrow drops to 20% or below of original budget |

### Lead Lifecycle

| #   | Event            | Subject                                                               | Recipient                     | Trigger                                                                  |
| --- | ---------------- | --------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| 15  | `lead.submitted` | —                                                                     | —                             | Email disabled (webhook only)                                            |
| 16  | `lead.verified`  | "You earned from {CAMPAIGN}" / "Lead verified for {CAMPAIGN}"         | Both (affiliate + advertiser) | Advertiser verifies a lead                                               |
| 17  | `lead.rejected`  | "Conversion rejected for {CAMPAIGN}" / "Lead rejected for {CAMPAIGN}" | Both (affiliate + advertiser) | Advertiser rejects a lead                                                |
| 18  | `lead.disputed`  | "Commission reversed for {CAMPAIGN}" / "Lead disputed for {CAMPAIGN}" | Both (affiliate + advertiser) | Advertiser disputes a previously verified lead during the holding period |

### Tracking & Attribution

| #   | Event                | Subject                             | Recipient                     | Trigger                                 |
| --- | -------------------- | ----------------------------------- | ----------------------------- | --------------------------------------- |
| 19  | `click.tracked`      | —                                   | —                             | Email disabled (webhook only)           |
| 20  | `postback.received`  | "Conversion confirmed via postback" | Both (affiliate + advertiser) | Server-to-server postback received      |
| 21  | `referral.created`   | —                                   | —                             | Email disabled (webhook only)           |
| 22  | `referral.confirmed` | "Referral confirmed for {CAMPAIGN}" | Both (affiliate + advertiser) | Advertiser confirms referral conversion |
| 23  | `conversion.tracked` | —                                   | —                             | Email disabled (webhook only)           |

### Earnings Lifecycle

| #   | Event                      | Subject                            | Recipient | Trigger                                         |
| --- | -------------------------- | ---------------------------------- | --------- | ----------------------------------------------- |
| 24  | `deposit.confirmed`        | —                                  | —         | Email disabled (webhook only)                   |
| 25  | `earnings.pending_release` | "Earnings recorded for {CAMPAIGN}" | Affiliate | Lead verified and campaign has a holding period |
| 26  | `earnings.available`       | "Your earnings are now available"  | Affiliate | Holding period elapses or immediate release     |

### Payout Lifecycle

| #   | Event               | Subject                                | Recipient | Trigger                                     |
| --- | ------------------- | -------------------------------------- | --------- | ------------------------------------------- |
| 27  | `payout.requested`  | "Payout request received"              | Affiliate | Affiliate requests payout                   |
| 28  | `payout.processing` | —                                      | —         | Email disabled (webhook only)               |
| 29  | `payout.completed`  | "Your payout is complete"              | Affiliate | Onchain TX confirmed                        |
| 30  | `payout.failed`     | "There was a problem with your payout" | Affiliate | Onchain transfer fails                      |
| 31  | `payout.cancelled`  | "Payout cancelled"                     | Affiliate | Affiliate cancels pending payout            |
| 32  | `payout.rejected`   | "Payout rejected"                      | Affiliate | Not yet triggered in code (template exists) |

---

## Summary

| Metric                                         | Count                 |
| ---------------------------------------------- | --------------------- |
| Total email types defined                      | 32                    |
| Standalone transactional emails                | 4                     |
| Event-driven email types                       | 28                    |
| Emails with sending enabled                    | 23                    |
| Webhook-only (email disabled)                  | 8                     |
| Dual-recipient emails (affiliate + advertiser) | 6                     |
| Orphaned (template exists, no trigger)         | 1 (`payout.rejected`) |

---

## Key Implementation Details

- **Email service**: All emails sent via Resend API (`src/lib/email.ts`)
- **Standalone emails**: `src/lib/email.ts` (verification, login code, partner welcome, onboarding)
- **Event definitions**: `src/lib/notifications/events.ts`
- **Email templates**: `src/lib/notifications/emails.ts`
- **Notification dispatcher**: `src/services/notification.service.ts`
- **Dev mode**: When `RESEND_API_KEY` is not set, emails log to console instead of sending
