# TODOs from Agent Testing Workflows

## Skill File / Onboarding Fixes

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Remove `[your product]` variable from skill file | A | |
| 2 | Standardize onboarding questions for campaign setup | A | |
| 3 | Clarify partner/referral code in advertiser onboarding | | |
| 4 | Block actions until email verification | O | DONE |
| 5 | Fix: agent must save a local copy of skill.md | A | |
| 6 | Review Affiliate and Advertiser welcome emails | A | |

## Campaign & Dashboard UX

| # | Task | Owner | Status |
|---|------|-------|--------|
| 7 | Campaign activate button should show error message when not funded | O | DONE |
| 8 | Gate campaign activation until tracking handshake is confirmed | O | DONE |
| 9 | Configurable payout holding period (chargeback protection) | O | DONE |
| 10 | Affiliate enrollment lifecycle on dashboard | O | DONE |
| 11 | Admin API endpoints and dashboard actions | O | DONE |
| 12 | GET /api/v1/leads scoped to authenticated agent | O | DONE |

## Email & Verification

| # | Task | Owner | Status |
|---|------|-------|--------|
| 13 | Fix email ordering — welcome email after verification only | O | DONE |

## Agent Behavior / Skill File

| # | Task | Owner | Status |
|---|------|-------|--------|
| 14 | Make daily check-in setup more prominent in skill file | A | |
| 15 | Skill file: note compensation model is CPA-only for now | A | |
| 16 | Fix skill file: mention $10 minimum deposit | A | |
| 17 | Clarify Regatta's redirect model in skill file | A | |
| 18 | Refactor skill system: role-scoped directories | A | |

## Payouts & Financials

| # | Task | Owner | Status |
|---|------|-------|--------|
| 19 | $19 vs $20 payout discrepancy | O | CLOSED — platform fee removed, affiliates receive full payout |
| 20 | Clarify PLATFORM_CREDIT payout method | O | DONE — means "keep balance on platform", auto-completes |
| 21 | 30-day holding period for payouts (configurable) | O | DONE (merged with #9) |
| 22 | Payout mechanism — cron for matured holds, PLATFORM_CREDIT handler | O | DONE |
| 23 | Allow canceling payout requests | O | DONE |
| 24 | Re-enable USDC payments for funding | O | DEFERRED — needs on-chain monitoring infra |
| 25 | Re-architect funding: account-level wallet instead of per-campaign escrow | O | DONE |

## Error Handling

| # | Task | Owner | Status |
|---|------|-------|--------|
| 26 | Handle wrong-role actions | O | CLOSED — role guards already in place |
| 27 | Validate Ethereum addresses | O | CLOSED — already implemented |
| 28 | Check balance before payout | O | CLOSED — already implemented |

---

## Summary of Changes

### Phase 1 — Quick Fixes
- **#13**: Onboarding email now sends only after email verification (verify-email route)
- **#12**: `GET /api/v1/leads` and dashboard leads route scoped to authenticated agent
- **#7**: Campaign activate error display improved with styled error banner
- **#19, #26, #27, #28**: Closed (by design / already implemented)

### Phase 2 — Security Gates
- **#4**: `requireEmailVerified()` middleware blocks: campaign creation, Stripe deposits, campaign applications
- **#8**: `trackingConfirmedAt` field on Campaign; new `POST /confirm-tracking` endpoint; activation gated on it

### Phase 3 — Payout Infrastructure
- **#9/#21**: `holdingPeriodDays` on Campaign (default 30); `PENDING_RELEASE` hold status with `releaseAt`; `processMaturedHolds()` cron function
- **#23**: `cancelPayout()` function + `POST /api/v1/payouts/:id/cancel` route
- **#22**: Cron route `POST /api/cron/process-holds`; PLATFORM_CREDIT auto-completes

### Phase 4 — Dashboard UX
- **#10**: Affiliate campaigns page shows all enrollment statuses (PENDING, APPROVED, REJECTED, REVOKED)
- **#11**: Admin API endpoints for suspend/activate agents + process/reject payouts; dashboard pages enhanced with action buttons

### Phase 6 — Funding Model Re-architecture
- **#25**: `StripeCheckoutSession.campaignId` now optional; deposits go to wallet; `allocateBudget()` moves funds wallet→escrow; deposit form defaults to "Account balance"

### Schema Changes (migration needed)
- `Campaign.holdingPeriodDays Int @default(30)`
- `Campaign.trackingConfirmedAt DateTime?`
- `EscrowHold.releaseAt DateTime?`
- `HoldStatus.PENDING_RELEASE` enum value
- `StripeCheckoutSession.campaignId` now optional
