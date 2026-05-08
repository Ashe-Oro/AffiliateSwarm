# Regatta: Complete the Platform

## Context

Regatta has ~95% of the foundation built (schema, services, routes, tests, UI) but the critical wiring between services is missing. The result: campaigns can't be activated, leads can't be paid, reputation never updates, webhooks never fire, and the SDK points to wrong endpoints. The platform looks complete but doesn't actually work end-to-end.

## What's Broken

### The Money Loop (CRITICAL)
1. **No campaign activation** — campaigns are created as DRAFT but there's no way to make them ACTIVE. Affiliates can only discover ACTIVE campaigns, so the marketplace is empty.
2. **No escrow hold on lead submission** — when a lead is submitted, `escrowService.placeHold()` is never called, so no funds are reserved.
3. **No payout on lead verification** — when an advertiser verifies a lead, `escrowService.releaseHold()` is never called, so the affiliate never gets paid.
4. **No refund on lead rejection** — when a lead is rejected, `escrowService.refundHold()` is never called, so funds stay locked forever.

### Side Effects Never Fire
5. **Reputation never updates** — `reputationService.recalculateReputation()` exists but is never called from any business flow.
6. **Webhooks never fire** — `webhookService.deliverEvent()` exists but is never called from anywhere.

### SDK Broken
7. **SDK uses wrong endpoints** — all paths in `src/sdk/client.ts` are wrong (missing `/v1/`, wrong path structures).

---

## Plan

### Step 1: Campaign Activation
**Files:** `src/services/campaign.service.ts`, `src/app/api/v1/campaigns/[campaignId]/activate/route.ts`

- Add `activateCampaign(campaignId, advertiserId)` to campaign service
  - Verify campaign is in DRAFT status
  - Verify escrow account has sufficient funds (budget > 0 deposited)
  - Transition status to ACTIVE
- Create `POST /api/v1/campaigns/[campaignId]/activate` route
- Update skill.md to document the activate step

### Step 2: Wire Escrow into Lead Lifecycle
**Files:** `src/services/lead.service.ts`

- In `submitLead()`: after creating the lead, call `escrowService.placeHold(escrowId, leadId, affiliateId, payoutAmount)` to reserve funds
  - Calculate payout amount from campaign's compensation model
  - If escrow has insufficient funds, reject the lead submission
- In `verifyLead()`: after marking lead as VERIFIED, call `escrowService.releaseHold(holdId)` to pay the affiliate
- In `rejectLead()`: after marking lead as REJECTED, call `escrowService.refundHold(holdId)` to return funds to escrow

### Step 3: Wire Reputation Updates
**Files:** `src/services/lead.service.ts`

- In `verifyLead()`: after escrow release, call `reputationService.recalculateReputation(affiliateId)`
- In `rejectLead()`: after escrow refund, call `reputationService.recalculateReputation(affiliateId)`
- Import reputation service in lead service

### Step 4: Wire Webhook Events
**Files:** `src/services/lead.service.ts`, `src/services/campaign.service.ts`

- In `verifyLead()`: call `webhookService.deliverEvent('lead.verified', { leadId, campaignId, affiliateId })`
- In `rejectLead()`: call `webhookService.deliverEvent('lead.rejected', { leadId, campaignId, reason })`
- In `activateCampaign()`: call `webhookService.deliverEvent('campaign.activated', { campaignId })`
- In `submitLead()`: call `webhookService.deliverEvent('lead.submitted', { leadId, campaignId })`
- Wrap all webhook calls in try/catch so failures don't break the main flow

### Step 5: Fix SDK Client
**File:** `src/sdk/client.ts`

Fix all endpoint paths to match actual API routes:
- `register()` → `/api/v1/agents`
- `discoverCampaigns()` → `/api/v1/discover/campaigns`
- `applyToCampaign()` → `/api/v1/campaigns/{id}/applications`
- `createCampaign()` → `/api/v1/campaigns`
- `submitLead()` → `/api/v1/leads`
- `checkBalance()` → `/api/v1/wallets/{agentId}` (needs agentId param)
- `getReputation()` → `/api/v1/reputation/{agentId}`
- Add `activateCampaign()` method

### Step 6: Update skill.md
**File:** `src/app/skill.md/route.ts`

- Add the activate step to the advertiser flow (create → fund → activate)
- Make the flow clearer: register → fund wallet → create campaign → deposit to escrow → activate

### Step 7: Verify End-to-End
Run the full money loop manually with curl:
1. Register advertiser agent
2. Register affiliate agent
3. Advertiser creates campaign (DRAFT)
4. Advertiser deposits to escrow
5. Advertiser activates campaign (→ ACTIVE)
6. Affiliate discovers campaign
7. Affiliate applies
8. Advertiser approves application
9. Affiliate submits lead
10. Verify escrow hold was placed
11. Advertiser verifies lead
12. Verify escrow released to affiliate wallet
13. Verify reputation was recalculated
14. Check affiliate wallet balance > 0

### Step 8: Git Commit
Stage and commit all changes.

---

## Files Modified

| File | Change |
|------|--------|
| `src/services/campaign.service.ts` | Add `activateCampaign()` |
| `src/app/api/v1/campaigns/[campaignId]/activate/route.ts` | New route |
| `src/services/lead.service.ts` | Wire escrow hold/release/refund + reputation + webhooks |
| `src/sdk/client.ts` | Fix all endpoint paths |
| `src/app/skill.md/route.ts` | Add activate step to docs |

## Verification

After implementation, run the 14-step curl test above. Every step must succeed. The key assertion: after step 12, the affiliate's wallet balance should show the payout amount from the campaign's compensation model.
