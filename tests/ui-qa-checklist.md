# PR #73 Test Plan — API-UI Functional Sync

**Preview URL:** Set to the current AffiliateSwarm preview URL before running.
**Branch:** `API-UI-functional-sync`
**Issues:** #56–#71

---

## Prerequisites

- An **advertiser** account (agent type ADVERTISER or DUAL)
- An **affiliate** account (agent type AFFILIATE or DUAL) — can be the same DUAL account
- At least one campaign in DRAFT or ACTIVE status
- Some test lead / conversion data is helpful but not required

---

## 1. Advertiser Dashboard

### 1.1 Settings Page — `/dashboard/settings`

**Issue #61 (Profile Editing), #62 (API Keys), #63 (Deactivation), #64 (Webhooks)**

- [ ] **Account Info card** renders at the top with display name, email, and account created date
- [ ] **Agent Info card** shows: Agent ID, Type, Status badge, Verification Level badge, Display Name, Email with verification badge
- [ ] **Email field** displays the agent's email address
- [ ] **Email badge** shows "email verified" (green) or "email unverified" (red) depending on verification level
- [ ] Click **Edit Profile** — form appears with fields: Display Name, Description, Website URL, Contact Endpoint, Logo URL
- [ ] Change Display Name → click **Save Changes** → page refreshes with updated name
- [ ] Click **Cancel** in edit form → form closes, original values still shown
- [ ] **API Keys card** lists any existing keys with prefix, label, and created date
- [ ] Click **Create API Key** with a label → success modal opens with the full key shown once and a copy button
- [ ] Click **Revoke** on a key → confirmation dialog → key removed from list
- [ ] **Webhooks card** lists any registered webhooks with URL, event badges, masked secret
- [ ] Create a webhook: enter URL, select event checkboxes (lead.submitted, etc.) → webhook appears in list with full secret shown once
- [ ] Delete a webhook → confirmation → removed from list
- [ ] **Deactivate Account card** at bottom has red/destructive styling
- [ ] Type display name incorrectly → Submit button stays disabled
- [ ] Type display name correctly → Submit button enables (do NOT actually submit unless using a throwaway account)

### 1.2 Campaign Creation — `/dashboard/campaigns/new`

**Issue #71 (Missing Creation Fields)**

- [ ] Page loads with all original fields (name, description, payout, budget, etc.)
- [ ] **New fields visible:** Daily Cap (Count), Daily Cap (Spend), Holding Period Days, Requires Verification (checkbox), Starts At, Ends At
- [ ] Holding Period Days defaults to `30`
- [ ] Requires Verification checkbox defaults to checked
- [ ] Create a campaign with some new fields filled in → verify it saves without errors
- [ ] **Buyer Incentive section:** "Offer a buyer incentive" checkbox visible, unchecked by default
- [ ] Check the incentive checkbox → incentive fields appear (Type, Value, Label, Coupon Code)
- [ ] Incentive Type dropdown has options: Percentage Off, Fixed Amount Off, Free Trial, Custom
- [ ] Value label changes based on type (e.g., "Discount (%)" for Percentage Off, "Discount Amount ($)" for Fixed Amount Off)
- [ ] Coupon Code field has helper text explaining `?promo=CODE` URL behavior
- [ ] Uncheck the incentive checkbox → fields disappear, incentive not sent with form
- [ ] Create a campaign with buyer incentive → API response includes `buyerCouponCode`

### 1.3 Campaign Detail — `/dashboard/campaigns/[id]`

**Issue #59 (Edit/Delete), #60 (Budget Allocation)**

- [ ] Page shows campaign header with name, status badge, and description
- [ ] **DRAFT campaign:** Edit button and Delete button both visible in header
- [ ] **ACTIVE campaign:** neither Edit nor Delete visible (campaign is live)
- [ ] **PAUSED campaign:** Edit button visible, Delete button hidden
- [ ] Click **Edit** → form expands with all editable fields (name, description, payout, budget, landing URL, categories, geo targets, enrollment policy, daily caps, holding period, verification toggle)
- [ ] Edit a field → Save → page refreshes with updated values, form collapses
- [ ] Click **Delete** on a DRAFT campaign → confirmation dialog → campaign deleted, redirected to campaigns list
- [ ] **Allocate Funds card** shows wallet available balance and current escrow balance
- [ ] Enter an amount → click Allocate → balances update (available goes down, escrow goes up)
- [ ] **Max button** fills the full wallet available balance
- [ ] Entering amount > wallet balance → shows validation error

### 1.4 Leads Page — `/dashboard/leads`

**Issue #70 (Pagination & Filtering)**

- [ ] Page loads showing all leads in a table (Campaign, External ID, Status, Payout, Submitted, Actions)
- [ ] **Status filter buttons** at top: All, Pending, Verified, Rejected
- [ ] Click **Pending** → URL changes to `?status=PENDING_REVIEW`, table filters to pending leads only
- [ ] Click **All** → filter clears, shows all leads again
- [ ] Active filter button is highlighted (filled/default variant), others are outline
- [ ] If more than 25 leads: pagination controls appear at bottom with "Page X of Y (Z leads)"
- [ ] **Previous/Next buttons** navigate between pages, URL updates with `?page=`
- [ ] Filtering resets to page 1

### 1.5 Performance Page — `/dashboard/performance`

**Issue #66 (Analytics Dashboard), #68 (Conversions), #70 (Pagination)**

- [ ] Page loads with header "Performance"
- [ ] **Period selector**: 7d, 30d, 90d — active period highlighted
- [ ] **Five KPI cards:** Total Leads, Verified Leads, Conversions, Payout Spend, Active Campaigns
- [ ] **Live Status** section shows 24h leads, verification rate, escrow balance, and burn rate
- [ ] **Conversion Ledger** includes conversion tables and pagination when needed
- [ ] **Non-CPA conversions table** with columns: Campaign, Affiliate, Action, Status, Revenue, Payout, Date
- [ ] Action type shown as outline badge, Status as colored badge (green for verified/attributed, red for rejected)
- [ ] If more than 25 conversions: pagination controls appear in the Conversion Ledger
- [ ] Empty state shows "No conversion events yet." if no data

### 1.6 Discover Affiliates — `/dashboard/discover`

**Issue #69 (Discovery), #70 (Pagination)**

- [ ] Page loads with header "Discover Affiliates"
- [ ] Each affiliate shown as a Card with display name, description
- [ ] **Trust tier badge** (PREMIUM/TRUSTED/VERIFIED/etc.) and overall score shown if reputation data exists
- [ ] Stats shown: Leads, Verified, Conversions counts
- [ ] Website URL displayed if available
- [ ] If more than 20 affiliates: pagination controls with Previous/Next
- [ ] Empty state: "No affiliates found." card

### 1.8 Navigation

- [ ] Sidebar includes all expected items: Overview, Campaigns, Leads, Performance, Wallet, Settings
- [ ] All sidebar links navigate to the correct pages

---

## 2. Affiliate Dashboard

### 2.0 My Campaigns — `/affiliate/campaigns`

- [ ] Page loads with header "My Campaigns"
- [ ] Enrolled campaigns display as cards with name, compensation model, status badges
- [ ] **Buyer Incentive badge:** campaigns with `buyerIncentiveLabel` show a "Buyer Incentive" badge + label text
- [ ] Coupon code shown in `<code>` element next to incentive label (if present)
- [ ] Tracking link includes `?promo=CODE` when campaign has a buyer coupon code
- [ ] Tracking link does NOT include `?promo=` when campaign has no coupon code
- [ ] Campaigns without incentives render without incentive section (no empty badge)

### 2.1 Wallet Page — `/affiliate/wallet`

**Issue #56 (Payout Request Form)**

- [ ] **Payout request form** visible (NOT "Tell your agent: Request a payout" text)
- [ ] Available balance displayed prominently
- [ ] **Method selector:** CRYPTO option only
- [ ] Select **CRYPTO** → Chain Address input appears (pre-filled if wallet has one)
- [ ] **Amount input** in dollars with **Max button** that fills available balance
- [ ] Enter amount < $1.00 → validation prevents submission
- [ ] Enter amount > available balance → validation error
- [ ] Enter invalid chain address (not `0x` + 40 hex chars) → validation error
- [ ] Submit valid request → success message with PENDING status, page refreshes with updated balances

### 2.2 Earnings Page — `/affiliate/earnings`

**Issue #58 (Payout Cancellation), #70 (Pagination & Filtering)**

- [ ] **Total Verified Earnings** card at top with dollar amount
- [ ] **By Campaign** table showing campaign name, compensation model badge, conversion count, earnings
- [ ] **Leads section** with status filter buttons: All, Pending, Verified, Rejected
- [ ] Clicking a filter updates the leads table, URL changes with `?status=`
- [ ] Leads table: Campaign, Status badge, Payout, Submitted date
- [ ] If more than 25 leads: pagination with "Page X of Y (Z leads)" and Previous/Next
- [ ] **Payout History** section (visible if any payouts exist)
- [ ] Table columns: Amount, Method, Status badge, Requested date, Completed date, Action
- [ ] **PENDING payouts** have a red **Cancel** button in the Action column
- [ ] Click Cancel → confirmation dialog → payout cancelled, page refreshes
- [ ] COMPLETED/FAILED/PROCESSING payouts have no Cancel button
- [ ] If more than 25 payouts: separate pagination controls

### 2.3 Reputation Page — `/affiliate/reputation`

**Issue #65 (Reputation & Trust Score)**

- [ ] Page loads with header "Reputation"
- [ ] **Header row:** Trust tier badge + overall score (X/100) + fraud flags count
- [ ] **Stats cards** (4 cards): Total Leads Submitted, Verified Leads, Conversions, Total Earnings
- [ ] **Dimension Scores** section with horizontal bars for: Lead Quality, Conversion Rate, Compliance, Longevity, Volume Consistency — each showing score out of 100
- [ ] **Peer Ratings** table: Rater, Score, Comment columns
- [ ] If no reputation data: "No reputation data yet" message

### 2.4 Referrals Page — `/affiliate/referrals`

**Issue #67 (Referral Token Management)**

- [ ] Page loads with header "Referrals"
- [ ] **Create Referral Token** card with campaign selector dropdown and expiry hours input (default 720)
- [ ] Campaign dropdown only shows campaigns with APPROVED enrollment + ACTIVE status
- [ ] If no eligible campaigns: "You need to be enrolled in an active campaign" message
- [ ] Create a referral → token displayed (copy it), page refreshes with new token in list
- [ ] **Your Referrals** table: Campaign, Token (truncated monospace), Status badge, Expires date, Confirmed date
- [ ] Status badge: CONFIRMED = green, EXPIRED = red, others = gray
- [ ] Empty state: "No referrals yet."

### 2.5 Navigation

- [ ] Sidebar includes: Overview, My Campaigns, Discover, Earnings, Wallet, Reputation, Referrals
- [ ] All sidebar links navigate to the correct pages
- [ ] "Switch to Advertiser Dashboard" link at bottom of sidebar works (for DUAL accounts)

---

## 3. Cross-Cutting Checks

### 3.1 Error Handling

- [ ] Submit a form with network disconnected → error message displays, form doesn't get stuck in loading state
- [ ] API errors show meaningful messages (not generic "Something went wrong" for known errors like insufficient balance)

### 3.2 Responsiveness

- [ ] Pages don't break on narrow viewports (cards stack, tables scroll horizontally)
- [ ] KPI card grids collapse from 5/4/3 columns to 2 to 1 on smaller screens

### 3.3 Empty States

- [ ] All tables show a centered "No X yet" message when there's no data
- [ ] Analytics charts show "No data yet" / "No data for this period"
- [ ] Payout history section is hidden entirely when there are no payouts

### 3.4 Data Integrity

- [ ] Dollar amounts formatted correctly (e.g., `$12.50` not `$1250` or `$12.5`)
- [ ] Dates formatted consistently (e.g., "Mar 30, 2:15 PM")
- [ ] Status badges use correct colors: green for positive states, red for negative, gray for neutral

---

## 4. Known Limitations

- **No email editing** — email is set at registration and verified separately; displayed as read-only on settings page
- **Campaign delete** — only available for DRAFT campaigns (intentional safeguard)
- **Campaign edit** — only available for DRAFT and PAUSED campaigns
- **Pre-existing TS error** — `.next/types/validator.ts` references deleted `session-debug/route.js`; unrelated to this PR
- **No dedicated campaign leads sub-page** — `/dashboard/campaigns/[id]/leads` link exists in UI but route not yet created; leads are shown inline on the campaign detail page
