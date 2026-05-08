# Affiliate Lead Reversal Clarification

## Plan

- [x] Create isolated worktree and feature branch for the copy update
- [x] Update affiliate dashboard copy so `DISPUTED` leads are shown as a final reversal, not an open dispute
- [x] Clarify in affiliate docs that lead outcomes and payout request statuses are separate concepts
- [x] Verify the updated copy against the current API model and review the diff

## Review

- Worktree created at `/Users/ashe/Projects/swarm-affiliate-lead-reversal`
- Feature branch created: `feat/affiliate-lead-reversal-copy`
- Affiliate dashboard now renders `DISPUTED` leads as `reversed` on affiliate-facing screens
- Affiliate earnings view now explains that payout statuses apply only to withdrawal requests
- Affiliate skill docs now separate lead outcomes from payout request statuses and document `status=DISPUTED` as a reversed lead commission
- Affiliate overview page now reinforces that reversed leads and payout requests are separate concepts
- Notification audit confirms `lead.disputed` already fires from the dispute flow and is configured for both email and webhook delivery
- Affiliate notification copy now describes `lead.disputed` as a commission reversal rather than a disputed payout
- Affiliate webhook examples now include `lead.disputed` in onboarding, skill, and manual test docs

---

# Affiliate Verification Gating Spec

## Context

Newly registered affiliates currently receive active API credentials immediately, before email verification is completed. This allows certain affiliate actions to occur while `verificationLevel` is still `UNVERIFIED`.

Business requirement:

- After registration, an affiliate must not be able to query for new campaigns until they click the email verification link.
- Other affiliate endpoints that represent active participation or value movement should also be blocked until the affiliate is verified.

## Goals

1. Prevent unverified affiliates from discovering campaigns.
2. Apply consistent verification gating across affiliate action endpoints (API key + dashboard + MCP).
3. Centralize policy to reduce route-by-route drift.
4. Preserve read-only/account bootstrap behavior needed to complete verification.

## Non-Goals

- Changing registration flow to delay API key issuance.
- Reworking advertiser verification policy in this task.
- Requiring identity/KYC verification for all actions (unless separately specified).

## Verification Policy (Proposed)

- Minimum required affiliate verification for restricted actions: `verificationLevel !== "UNVERIFIED"`.
- Accepted levels for restricted actions:
  - `EMAIL_VERIFIED`
  - `IDENTITY_VERIFIED`
- Denied level:
  - `UNVERIFIED`

This matches current `requireEmailVerified()` semantics and satisfies the email-link requirement while allowing stronger future policy without API shape changes.

## Endpoint Classification

### A) Must Be Restricted Until Verified

These endpoints allow campaign participation, earnings generation, or funds movement.

#### Core affiliate API (v1)

- `GET /api/v1/discover/campaigns`
- `POST /api/v1/campaigns/:campaignId/applications` (already restricted)
- `POST /api/v1/leads`
- `POST /api/v1/referrals`
- `POST /api/v1/conversions`
- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/timeseries`
- `GET /api/v1/analytics/campaigns/:campaignId`
- `POST /api/v1/payouts`
- `GET /api/v1/payouts`
- `POST /api/v1/payouts/:payoutId/cancel`

#### Dashboard affiliate API (cookie session)

- `POST /api/dashboard/affiliate/apply`
- `POST /api/dashboard/affiliate/referrals`
- `POST /api/dashboard/affiliate/payout`
- `POST /api/dashboard/affiliate/payout/:payoutId/cancel`

#### MCP tools (direct service calls)

- `discover_campaigns`
- `apply_to_campaign`
- `submit_lead`

### B) Should Remain Allowed While Unverified

These support onboarding/completion of verification and account introspection.

- `GET /api/v1/me`
- `GET /api/v1/onboarding/status`
- `GET /api/v1/agents/:agentId`
- `GET /api/v1/agents/:agentId/verify-email?token=...` (public verification click path)
- Authentication/login-code bootstrap endpoints
- Non-affiliate advertiser/admin/platform operations (unchanged in this spec)

## Design

### 1) Introduce explicit affiliate verification guards

Add reusable guards in auth layer:

- API route middleware guard for API-key/HMAC routes:
  - `requireVerifiedAffiliate()`
  - Behavior: if caller is affiliate-capable (`AFFILIATE` or `DUAL`) and `verificationLevel === "UNVERIFIED"`, return 403 `EMAIL_NOT_VERIFIED`.
  - If caller is advertiser-only, pass through.

- Dashboard cookie-session guard:
  - Extend `requireAffiliateAgent()` with optional mode:
    - default: existing behavior (backward compatibility)
    - strict mode for affiliate action routes: enforce non-UNVERIFIED.

- MCP helper guard:
  - Before affiliate tool execution, fetch agent and enforce same non-UNVERIFIED policy.

### 2) Apply guards at route boundaries

- Attach guard wrappers in all endpoints listed in section A.
- Keep enforcement at route boundary (not deep service layer) for clear API behavior and consistent error shape.

### 3) Error contract

Use existing error contract:

- code: `EMAIL_NOT_VERIFIED`
- status: `403`
- message: existing guidance to verify via email link.

No response schema changes.

## Security/Consistency Considerations

- Policy must be consistent across:
  - API key Bearer routes
  - HMAC routes
  - Dashboard session routes
  - MCP tools
- Avoid relying on frontend-only checks.
- Keep checks deterministic using authenticated agent record only.

## Test Plan

### Unit / Route tests

Add or update tests to prove:

1. `UNVERIFIED` affiliate receives 403 on each restricted endpoint.
2. `EMAIL_VERIFIED` affiliate succeeds (assuming other domain rules pass).
3. Advertiser behavior on advertiser endpoints is unchanged.
4. Existing already-restricted route (`POST /campaigns/:id/applications`) still behaves identically.

### Integration / e2e

Scenario sequence:

1. Register affiliate with email; retain API key.
2. Call `GET /api/v1/discover/campaigns` -> expect 403 `EMAIL_NOT_VERIFIED`.
3. Verify via email endpoint.
4. Retry `GET /api/v1/discover/campaigns` -> expect 200.
5. Confirm at least one additional restricted endpoint (e.g. `POST /api/v1/referrals`) flips from 403 pre-verify to domain-valid response post-verify.

### MCP validation

1. Invoke `discover_campaigns` with unverified agent -> structured error.
2. Verify email.
3. Retry -> success.

## Rollout Plan

1. Implement shared guards.
2. Apply to restricted endpoints in small, reviewable commits.
3. Run route/unit tests and staging e2e script focused on verification transitions.
4. Update API docs to clarify verification prerequisite for affiliate action endpoints.

## Risks and Mitigations

- Risk: accidentally gating read-only onboarding endpoints.
  - Mitigation: explicit allow-list (section B) and focused regression tests.
- Risk: policy mismatch between dashboard and API key surfaces.
  - Mitigation: shared guard semantics + dual-surface tests.
- Risk: MCP bypasses HTTP middleware.
  - Mitigation: explicit MCP pre-check helper.

## Acceptance Criteria

- Unverified affiliates cannot discover campaigns.
- Unverified affiliates cannot perform any section A action via v1 API, dashboard API, or MCP.
- Verified affiliates (`EMAIL_VERIFIED` or higher) can perform section A actions subject to existing business rules.
- Error response for verification failures is consistent (`403 EMAIL_NOT_VERIFIED`).
- Tests cover pre-verification denial and post-verification success path.

---

# Advertiser Campaign Detail Page — Unified Cleanup (#224, #225, #226)

## Scope

Three open issues all touch `src/app/dashboard/campaigns/[campaignId]/page.tsx`. Bundle them into one body of work so we refactor the detail page once.

- **#226** — Show all campaign parameters in a read-only "Campaign Settings" panel (primary gap: `holdingPeriodDays` invisible).
- **#225** — Remove the stale "Allocate Funds" card + wire removal.
- **#224** — For CPA campaigns, collapse Leads + Conversions into one Conversions view with status, days remaining, concrete maturity date, dispute action, and a server-side maturation cron.

## Sequencing

Land as **three PRs** in order, smallest first. Each PR is independently shippable but staged so the surface area of the detail page contracts/expands predictably.

1. **PR 1 (#225)** — Remove Allocate Funds card. Smallest, removes code, unblocks layout decisions for PR 2/3.
2. **PR 2 (#226)** — Add Campaign Settings panel (read-only parameters).
3. **PR 3 (#224)** — Introduce unified Conversions view + maturation cron + API-level dispute guard.

## PR 1 — Remove Allocate Funds (#225)

### Files to change
- [ ] Delete `src/components/dashboard/allocate-funds-form.tsx`
- [ ] Delete `src/app/api/v1/campaigns/[campaignId]/allocate/route.ts`
- [ ] Delete `src/app/api/dashboard/campaigns/[campaignId]/allocate/route.ts`
- [ ] Edit `src/app/dashboard/campaigns/[campaignId]/page.tsx`: remove import (line ~25) and the `<Card>` block (lines ~221–239)
- [ ] Grep `allocateBudget` to confirm: if only `escrow.service.ts` + MCP still call it, keep the service; if MCP path is also dead here, flag for a follow-up rather than bundling removal

### Tests
- [ ] Playwright smoke: advertiser opens campaign detail page, "Allocate Funds" heading is gone
- [ ] Assert no remaining imports of `AllocateFundsForm` (grep + tsc)
- [ ] API integration test: `DELETE` routes return 404 (routes no longer exist)

### Acceptance
- Card fully removed; no broken CTAs referenced anywhere else.
- No dead imports / unused components left behind.

---

## PR 2 — Campaign Settings read-only panel (#226)

### Design
New `<Card>` titled **"Campaign Settings"** inserted on the detail page (where Allocate Funds used to be, after the existing "Campaign Details" card). Reuse the `dl/dt/dd` definition-list pattern from `src/app/dashboard/settings/page.tsx:80-99` and the admin campaign detail page at `src/app/admin/campaigns/[campaignId]/page.tsx:160-255`.

### Fields to render (grouped)

Verification & Hold
- `requiresVerification` → "Yes" / "No"
- `holdingPeriodDays` → `"0 days (instant)"` when 0, else `"{n} days"`

Daily Limits
- `dailyCapCount` → number or `"No limit"`
- `dailyCapCents` → currency or `"No limit"`

Schedule
- `startsAt`, `endsAt` → formatted date or `"—"`

Product & Conversion
- `productUrl`, `conversionAction`, `productDescription`

Buyer Incentive (only when any buyer-incentive field is set)
- `buyerIncentiveType`, `buyerIncentiveValue`, `buyerIncentiveLabel`, `buyerCouponCode`

Platform
- Platform fee % (pull from current fee constant; label it as "Platform fee applied on verified conversions")
- `createdAt`, `updatedAt`

### Files to change
- [ ] Edit `src/app/dashboard/campaigns/[campaignId]/page.tsx`: extend props passed to `CampaignDetailClient` (lines ~117–137) with the missing fields
- [ ] Edit `src/components/dashboard/campaign-detail-client.tsx`: expand the `CampaignData` interface (lines ~22–42) with the additional fields; render the new Card (or create `src/components/dashboard/campaign-settings-panel.tsx` and embed it — prefer a dedicated component for testability)
- [ ] Add shared formatters in `src/lib/formatters.ts` if not present: `formatHoldPeriodDays(n)`, `formatOptionalCurrency`, `formatOptionalCount`

### Tests
- [ ] Unit: formatter for `holdingPeriodDays` — asserts `0 → "0 days (instant)"`, `30 → "30 days"`
- [ ] Component test for `CampaignSettingsPanel` — each field group renders expected strings given a fixture campaign
- [ ] Playwright: edit campaign, change hold period 30 → 0, save, reload detail page, assert "0 days (instant)" is visible
- [ ] Playwright: campaign with no caps / no buyer incentive renders "No limit" / hides incentive group

### Acceptance
- Every field editable in `EditCampaignForm` is surfaced read-only on the detail page.
- Hold period is always visible and correctly renders the zero case.
- No API or DB lookup required to verify a config change.

---

## PR 3 — Unified Conversions view + maturation cron + dispute guard (#224)

### Data model decisions

The existing system uses **Lead + EscrowHold** as the source of truth for payout state; `ConversionEvent` is a loosely-coupled tracking row. For CPA campaigns we do **not** introduce a new table — we project a unified "Conversion" row from `Lead` joined to its `EscrowHold` (and optionally `ConversionEvent`).

Unified display status derived from `Lead.status` + `EscrowHold.status`:

| Display Status | Source |
|---|---|
| `Pending` | Lead.status = SUBMITTED / PENDING_VERIFICATION |
| `Held` | Lead.status = VERIFIED, EscrowHold.status = PENDING_RELEASE, releaseAt > now |
| `Matured` | EscrowHold.status = RELEASED (affiliate credited, dispute window closed) |
| `Disputed` | Lead.status = DISPUTED (terminal, funds refunded to advertiser) |
| `Reversed` | alias for DISPUTED in advertiser-facing copy (keep single term — pick Reversed per earlier affiliate-facing decision, or Disputed; confirm with product) |
| `Paid` | After RELEASED + affiliate payout executed — derive from payout transaction join |
| `Rejected` | Lead.status = REJECTED (separate from Disputed; advertiser rejected pre-verification) |

**Maturity date** = `EscrowHold.releaseAt` (already computed at verification time). **Days remaining** = `max(0, ceil((releaseAt - now) / 1 day))`.

### UI changes
- [ ] New component `src/components/dashboard/campaign-conversions-table.tsx`
  - Columns: external id / affiliate, occurred/submitted date, display status, hold window (days remaining), **maturity date** (absolute, e.g. `"Matures May 17, 2026"`), dispute button
  - Dispute button disabled + tooltip `"Dispute window closed"` when display status is not `Held`
- [ ] Edit `src/app/dashboard/campaigns/[campaignId]/page.tsx`:
  - If `campaign.compensationModel === "CPA"`: render `<CampaignConversionsTable />` instead of the existing "Recent Leads" table (lines ~250–308) and hide the "View All Leads" / Applications buttons (or repoint them)
  - Non-CPA campaigns: preserve existing Leads UI unchanged
- [ ] Consider a top-level `/dashboard/campaigns/[campaignId]/conversions` route if we want a full paginated view; otherwise keep inline on detail page and link to the existing `/dashboard/conversions` for global view

### Server-side maturation (authoritative dispute cutoff)

Existing `processMaturedHolds()` in `src/services/escrow.service.ts:490-537` already transitions `PENDING_RELEASE → RELEASED` via the `/api/cron/process-holds` Vercel cron (every 5 min). **This is the maturation job #224 asks for — it already exists.**

Two gaps to close:
- [ ] **API-level dispute guard** — `src/services/lead.service.ts` `disputeLead()` already rejects when hold is RELEASED (line ~524–530). Add an explicit check `if (hold.releaseAt <= now) reject` even when the cron hasn't run yet, so the cutoff is enforced by clock not by cron latency. Return a structured error code `DISPUTE_WINDOW_CLOSED`.
- [ ] Ensure the dashboard dispute route surfaces `DISPUTE_WINDOW_CLOSED` with a clear message and the table disables the button accordingly (mirrors the same check client-side).

### Cron cadence
Existing process-holds runs every 5 min — stricter than the issue's "every 12h or daily" ask. Keep 5-min cadence (no change needed). Document this in the PR description so we don't spuriously add a duplicate cron.

### Files to change
- [ ] New: `src/components/dashboard/campaign-conversions-table.tsx`
- [ ] New: `src/lib/conversions/derive-display-status.ts` — pure fn mapping (Lead, EscrowHold) → display status
- [ ] Edit: `src/app/dashboard/campaigns/[campaignId]/page.tsx` — conditional CPA branch
- [ ] Edit: `src/services/lead.service.ts` `disputeLead()` — add `releaseAt <= now` check, structured error
- [ ] Edit: `src/app/api/dashboard/leads/[leadId]/dispute/route.ts` — surface structured error code
- [ ] New query helper to fetch CPA conversions for a campaign with EscrowHold join and pagination

### Tests
- [ ] Unit: `deriveDisplayStatus` table-driven — every (leadStatus, holdStatus, releaseAt) combo → expected display status
- [ ] Unit: `disputeLead` rejects with `DISPUTE_WINDOW_CLOSED` when `releaseAt <= now` even if hold still marked PENDING_RELEASE (race window)
- [ ] Integration: POST dispute after maturity → 409/422 with `DISPUTE_WINDOW_CLOSED`
- [ ] Playwright: CPA campaign detail page shows unified Conversions table; non-CPA campaign still shows Leads
- [ ] Playwright: advertiser disputes a held conversion → status flips to Disputed; button disappears
- [ ] Playwright: conversion past maturity → dispute button disabled with tooltip
- [ ] Cron smoke: hit `/api/cron/process-holds` with Bearer $CRON_SECRET, confirm matured holds transition

### Acceptance
- CPA campaigns: one Conversions view, no separate Leads tab for that campaign.
- Each row shows status, days-remaining, absolute maturity date.
- Dispute button works inside window, is disabled outside, and the API refuses a post-maturity dispute regardless of client state.
- No regression on non-CPA campaigns.

## Risks / Open Questions

- **Copy: Disputed vs Reversed** — affiliate side already uses "Reversed". Advertiser view historically uses "Disputed". Pick one term per audience; the memo on affiliate reversal clarification (earlier in this file) suggests audience-scoped copy is acceptable. Confirm with product before PR 3.
- **"Paid" status source** — requires joining to affiliate payout transactions. If that join is expensive or unclear, ship PR 3 without a distinct "Paid" state (fold into "Matured") and follow up.
- **Non-CPA unification** — issue #224 leaves this open. Recommendation: keep Leads tab for CPL/CPC/REV_SHARE where leads have independent meaning; only collapse for CPA. Document in PR 3 description.
- **`allocateBudget` service** — keep in PR 1; schedule follow-up cleanup if MCP also no longer uses it.
