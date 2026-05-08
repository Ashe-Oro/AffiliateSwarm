# Eng Review Decisions — 2026-03-19

These are the architecture and implementation decisions made during /plan-eng-review.
Read this + `launch-strategy.md` to understand the full scope.

## Key Discoveries
- **middleware.ts already exists** (admin auth + session cookies) — no work needed
- **CORS already configured** in next.config.ts — no work needed
- Actual remaining baseline: USDC sweep + email verification only

## Architecture Decisions

| # | Decision | Choice | Details |
|---|----------|--------|---------|
| 1 | Partner rev share | Move inside `$transaction()` | Currently fire-and-forget outside tx in escrow.service.ts:304-315. Critical money bug. |
| 2 | Sandbox DB routing | Request-scoped Prisma client | `getPrismaClient(apiKey)` — rgt_test_ → sandbox DB, rgt_live_ → production. Modify src/lib/prisma.ts. Services accept ctx.prisma. |
| 3 | Onboarding agent security | Strict capability boundary | Scoped API key (only register, createCampaign, createCheckoutSession, activateCampaign). Range checks on LLM outputs before Zod. |
| 4 | Logging | Install Pino | Production-grade structured JSON logger. Replace all 15 silent catch blocks. |
| 5 | trackClick returns | Discriminated union | Replace `return null` with `{ error: 'ENROLLMENT_NOT_FOUND' | 'NOT_APPROVED' | 'CAMPAIGN_INACTIVE' }` or `{ success: true, redirectUrl, clickId }` |
| 6 | PR strategy | Single PR | Ship everything together |
| 7 | Dashboard indexes | Add now | Composite indexes on leads(campaignId, submittedAt), leads(affiliateId, submittedAt), clickEvents(campaignId, clickedAt) |
| 8 | DRY auth | Extract helper | `assertCampaignOwner(campaignId, agentId)` — repeated 5+ times across services |
| 9 | Stripe fix | Export creditFromCheckout | Currently private, needs to be exported |
| 10 | Seed agent discovery | Polling | Call GET /discover/campaigns every 5 min |
| 11 | Seed agent leads | Identical treatment | No special flagging vs organic affiliates |
| 12 | Sandbox isolation | Separate Postgres DB | Same schema, different connection string |

## Build Order (single PR, ~10 hours CC)

| Step | Item | CC Time |
|------|------|---------|
| 1 | Install Pino + src/lib/logger.ts | ~15 min |
| 2 | Observability overhaul (fix 15 silent catches) | ~30 min |
| 3 | Extract assertCampaignOwner() DRY helper | ~10 min |
| 4 | trackClick() → discriminated union | ~10 min |
| 5 | Partner rev share → inside transaction | ~15 min |
| 6 | Export creditFromCheckout() | ~5 min |
| 7 | Email verification flow | ~30 min |
| 8 | Request-scoped Prisma client (sandbox) | ~30 min |
| 9 | USDC sweep cron job | ~45 min |
| 10 | Add composite database indexes | ~10 min |
| 11 | Onboarding agent (scoped API key + LLM) | ~2 hours |
| 12 | Real-time performance dashboard | ~1.5 hours |
| 13 | Expanded test suite (33 new tests) | ~30 min |
| 14 | Seed agent fleet (external repo, CrewAI) | ~4 hours |

## Files to Modify (observability overhaul)
- src/services/lead.service.ts — 5 silent catches
- src/services/campaign.service.ts — 3 silent catches
- src/services/tracking.service.ts — 6 silent catches
- src/services/escrow.service.ts — partner rev share + 1 silent catch
- src/lib/auth/middleware.ts — 2 .catch(() => {}) on lastUsedAt

## Test Target: 60 total (27 existing + 33 new)
See ~/.gstack/projects/omricohen-regatta/omri-master-test-plan-20260319-095200.md
