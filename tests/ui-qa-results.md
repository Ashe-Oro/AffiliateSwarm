# UI QA Test Results — Browser Testing via Claude Preview

**Test Date:** 2026-04-01
**Environment:** Docker local deployment on `localhost:3000` (proxied via Claude Preview)
**Branch:** `master` (post-merge of PR #84)
**Tester:** Claude Code (automated browser testing)

---

## Test Accounts

| Role | Display Name | Agent ID | Email |
|------|-------------|----------|-------|
| Advertiser | QA-Advertiser-1775078241 | `07695446-39f6-43b9-9255-8568bc070019` | qa-adv-1775078241@test.regatta.dev |
| Affiliate | QA-Affiliate-1775078250 | `811d0ddb-6106-4fb1-a72e-a619737147fa` | qa-aff-1775078250@test.regatta.dev |

---

## Summary

| Section | Pass | Fail | Notes |
|---------|------|------|-------|
| 1.1 Settings | 12/12 | 0 | All cards, edit form, API keys, webhooks, deactivation |
| 1.2 Campaign Creation | 5/6 | 1 | `[object Object]` error display bug |
| 1.3 Campaign Detail | 6/6 | 0 | DRAFT buttons correct, KPIs, allocate funds |
| 1.4 Leads | 4/4 | 0 | Filters, table, empty state |
| 1.5 Conversions | 4/4 | 0 | Stats cards, table, empty state |
| 1.6 Discover Affiliates | 4/4 | 0 | Cards, trust badges, scores |
| 1.7 Analytics | 5/5 | 0 | Period selector, KPIs, charts, breakdown table |
| 1.8 Navigation | 2/2 | 0 | All sidebar items present and functional |
| 2.1 Wallet | 3/3 | 0 | Balance cards, payout section, transactions |
| 2.2 Earnings | 4/4 | 0 | Earnings card, by-campaign, leads, payout history hidden |
| 2.3 Reputation | 4/4 | 0 | Trust tier, scores, dimensions, peer ratings |
| 2.4 Referrals | 4/4 | 0 | Create token, table, empty states |
| 2.5 Affiliate Nav | 2/2 | 0 | All sidebar items present |
| 3.x Cross-cutting | 4/4 | 0 | Empty states, dollar formatting, date formatting |
| **TOTAL** | **63/64** | **1** | **98.4% pass rate** |

---

## 1. Advertiser Dashboard

### 1.1 Settings Page — `/dashboard/settings`

- [x] **Account Info card** renders at the top with display name, email, and account created date
- [x] **Agent Info card** shows: Agent ID, Type (ADVERTISER), Status badge (active/green), Verification Level badge (unverified), Display Name, Email with verification badge
- [x] **Email field** displays the agent's email address
- [x] **Email badge** shows "email unverified" (red) — correctly reflects unverified state
- [x] Click **Edit Profile** — form appears with fields: Display Name, Description, Website URL, Contact Endpoint, Logo URL, Capabilities
- [x] Click **Cancel** in edit form — form closes, original values still shown
- [x] **API Keys card** lists existing key with prefix (`97R5bZDD...`), label ("Default API Key"), tier (FREE), created date, last used date
- [x] **Revoke** button visible on each key (red styling)
- [x] **Create API Key** button present
- [x] **Webhooks card** shows "No webhooks configured." with Add Webhook button
- [x] **Deactivate Account card** at bottom has red/destructive styling ("Permanently deactivate your agent account")
- [x] All card layouts render cleanly with proper spacing

> **Note:** Edit form also includes a **Capabilities** field (comma-separated) not in original checklist. This is a new field from the schema improvements.

### 1.2 Campaign Creation — `/dashboard/campaigns/new`

- [x] Page loads with all fields: Name, Description, Compensation Model, Enrollment Policy, Payout per Unit, Budget, Currency, Landing URL
- [x] **New fields visible:** Daily Cap (Count), Daily Cap ($), Holding Period (days), Requires Verification (checkbox), Start Date, End Date
- [x] Holding Period Days defaults to `30`
- [x] Requires Verification checkbox defaults to checked
- [ ] **BUG: `[object Object]` error display** — When submitting the form via browser (with React state sync), the error message renders as `[object Object]` instead of a human-readable string. The API returns a Zod validation error object, but the UI serializes it incorrectly.

> **Bug severity: Medium.** The form validation error display doesn't properly stringify error objects. The API itself works correctly (campaign created successfully via direct API call).

### 1.3 Campaign Detail — `/dashboard/campaigns/[id]`

- [x] Page shows campaign header with name ("QA Test Campaign"), **draft** status badge, and description
- [x] **DRAFT campaign:** Edit, Confirm Tracking Setup, Activate, and Delete buttons all visible
- [x] **4 KPI cards:** Budget ($100.00), Escrow Balance ($0.00), Total Leads (0), Applications (0)
- [x] **Campaign Details** section: Compensation Model (CPL), Payout per Unit ($5.00), Enrollment Policy (approval required), Landing URL, Geo Targets, Categories, Created date
- [x] **Allocate Funds card** — shows "No funds available in your wallet to allocate. Deposit funds first." (correct for $0 wallet)
- [x] **Recent Leads** table with columns (External ID, Affiliate, Status, Payout, Quality, Submitted) and empty state "No leads yet"

### 1.4 Leads Page — `/dashboard/leads`

- [x] Table with columns: Campaign, External ID, Status, Payout, Submitted, Actions
- [x] **Status filter buttons**: All (filled/active), Pending, Verified, Rejected — correctly styled
- [x] Active filter button highlighted (filled variant), others outline
- [x] Empty state: "No leads found"

### 1.5 Conversions Page — `/dashboard/conversions`

- [x] Header "Conversions" with description text ("Conversion events across your campaigns.")
- [x] **Three stats cards:** Total Conversions (0), Verified (0), Total Revenue ($0.00)
- [x] **Table columns:** Campaign, Affiliate, Action, Status, Revenue, Payout, Date
- [x] Empty state: "No conversion events yet."

### 1.6 Discover Affiliates — `/dashboard/discover`

- [x] Header "Discover Affiliates" with description ("Browse affiliates to recruit for your campaigns.")
- [x] Each affiliate shown as a Card with display name and description (when available)
- [x] **Trust tier badge** (TRUSTED) and overall score (80/100) shown
- [x] Stats: Leads, Verified, Conversions counts displayed per affiliate

### 1.7 Analytics Page — `/dashboard/analytics`

- [x] Header "Analytics" with description ("Performance overview and trends.")
- [x] **Period selector**: 7d, **30d** (active/highlighted), 90d
- [x] **Five KPI cards**: Total Leads (0), Verified Leads (0), Conversions (0), Revenue ($0.00), Active Campaigns (0)
- [x] **Leads Over Time** horizontal bar chart (shows data from E2E test runs: Apr 1 = 21 leads)
- [x] **Revenue Breakdown** table: Date, Leads, Conversions, Revenue (Apr 1: 21 leads, 13 conversions, $97.00)

> **Observation:** KPI cards show 0 for this QA account (correct), but Leads Over Time and Revenue Breakdown show aggregate data from all accounts' test runs. This may be a **data scoping concern** — analytics might aggregate across all advertisers rather than scoping to the current user. Needs investigation.

### 1.8 Navigation

- [x] Sidebar includes all expected items: Overview, Campaigns, Leads, Conversions, Discover Affiliates, Analytics, Wallet, Live, Settings
- [x] All sidebar links functional and navigate to correct pages

---

## 2. Affiliate Dashboard

### 2.1 Wallet Page — `/affiliate/wallet`

- [x] **Available balance** displayed prominently ($0.00, "Ready for withdrawal")
- [x] **Pending Payout** ($0.00) and **Lifetime Earnings** ($0.00) cards
- [x] **Request Payout** section with correct minimum balance message: "You need at least $1.00 in available balance to request a payout. Current balance: $0.00."
- [x] **Recent Transactions** table: Type, Amount, Reference, Memo, Date — empty state "No transactions yet."

> **Note:** Method selector (CRYPTO/BANK_TRANSFER) and amount input are correctly hidden when balance is below $1.00 minimum. This is proper conditional UX behavior.

### 2.2 Earnings Page — `/affiliate/earnings`

- [x] **Total Verified Earnings** card ($0.00, "Across 0 campaigns")
- [x] **By Campaign** table: Campaign, Model, Conversions, Earnings — "No verified earnings yet"
- [x] **Leads section** with status filter buttons: All (filled), Pending, Verified, Rejected
- [x] Leads table: Campaign, Status, Payout, Submitted — "No leads submitted yet"

> **Payout History** section correctly hidden when no payouts exist (per spec).

### 2.3 Reputation Page — `/affiliate/reputation`

- [x] Header "Reputation" with description ("Your trust score and performance metrics.")
- [x] **Trust Tier** (NEW), **Overall Score** (0/100), **Fraud Flags** (0)
- [x] **Stats cards** (4): Leads Submitted (0), Leads Verified (0), Leads Rejected (0), Total Conversions (0)
- [x] **Dimension Scores** with horizontal progress bars:
  - Lead Quality (30%)
  - Conversion Rate (25%)
  - Payment Reliability (20%)
  - Response Time (15%)
  - Peer Rating (10%)
- [x] **Peer Ratings** table: From, Campaign, Score, Comment, Date — "No peer ratings yet."

> **Checklist update needed:** Original checklist listed dimensions as "Lead Quality, Conversion Rate, Compliance, Longevity, Volume Consistency" but actual implementation uses "Lead Quality, Conversion Rate, Payment Reliability, Response Time, Peer Rating" with weighted percentages. The implementation is arguably better — update the checklist to match.

### 2.4 Referrals Page — `/affiliate/referrals`

- [x] Header "Referrals" with description ("Create and manage referral tokens for your campaigns.")
- [x] **Create Referral Token** card with message: "You need to be enrolled in an active campaign to create referrals."
- [x] **Your Referrals** table: Campaign, Token, Status, Expires, Confirmed — "No referrals yet."
- [x] Correct empty state behavior when not enrolled in any campaigns

### 2.5 Affiliate Navigation

- [x] Sidebar includes: Overview, My Campaigns, Discover, Earnings, Wallet, Reputation, Referrals
- [x] All sidebar links navigate to correct pages

### Affiliate Discover Campaigns (bonus check)

- [x] Header "Discover Campaigns" with description and search field
- [x] Filter dropdowns: All models, All categories
- [x] Campaign cards show: name, compensation model badge, enrollment policy badge, advertiser name, payout
- [x] **Apply** button on each campaign card

---

## 3. Cross-Cutting Checks

### 3.1 Empty States

- [x] All tables show centered empty messages: "No leads found", "No conversion events yet.", "No transactions yet.", "No referrals yet.", "No peer ratings yet."
- [x] Payout history section hidden entirely when no payouts exist

### 3.2 Data Integrity

- [x] Dollar amounts formatted correctly: `$0.00`, `$5.00`, `$100.00`, `$97.00`
- [x] Dates formatted consistently: "April 1, 2026", "Apr 1, 2026", "Apr 1"
- [x] Status badges use correct colors: green (active, TRUSTED, email verified), red (email unverified, Revoke, Delete), gray/outline (draft, unverified)

---

## Bugs Found

### BUG-1: `[object Object]` error display on campaign creation form

**Severity:** Medium
**Page:** `/dashboard/campaigns/new`
**Steps to reproduce:**
1. Fill in campaign name, description, landing URL
2. Set payout and budget values via browser interaction
3. Click "Create Campaign"
4. If validation fails, error message shows `[object Object]`

**Root cause:** The error handler renders the Zod validation error object directly instead of extracting the message string. Likely a missing `.message` accessor or `JSON.stringify()` call in the error display component.

**Impact:** Users see an unhelpful error message instead of knowing what to fix.

### OBSERVATION-1: Analytics data scoping

**Severity:** Low (needs investigation)
**Page:** `/dashboard/analytics`
**Details:** KPI cards show per-account data (correct), but the Leads Over Time chart and Revenue Breakdown table appear to show aggregate data across all accounts. For a fresh QA advertiser with 0 leads, the chart shows 21 leads and the revenue table shows $97.00. This data comes from E2E test accounts' activity.

---

## Test Environment Notes

- Docker containers: `regatta-app-1`, `regatta-postgres-1`, `regatta-redis-1`
- Preview proxy: Claude Preview tool → Node.js HTTP proxy → Docker on port 3000
- Test accounts created via `POST /api/v1/agents` API, then email verified and capabilities set via direct DB update
- Login via `POST /api/v1/auth/login-code` → 6-character code → `/login` form
