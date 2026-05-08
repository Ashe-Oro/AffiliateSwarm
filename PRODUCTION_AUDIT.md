# Production Audit — 2026-03-17

## What works

- **Money loop is wired correctly** — `submitLead()` places hold, `verifyLead()` calls `releaseHold()`, `rejectLead()` calls `refundHold()`
- **All API routes exist** and match docs/skill.md
- **SDK endpoints are correct**
- **Migrations are complete** — initial + USDC chain migration
- **Auth is solid** — Bearer + HMAC, rate limiting, RBAC
- **Security headers** configured in next.config.ts
- **Seed file** exists with sample data
- **Webhooks** actually fire with retries and HMAC signing
- **No TODO/FIXME** anywhere in the codebase
- **Fraud detection** works (velocity checks, fingerprinting, investigations)
- **Docker + Railway** deployment configs exist

## Must fix

| Issue | Impact | Effort |
|-------|--------|--------|
| No USDC sweep job (deposit addresses → hot wallet) | Payouts will fail because hot wallet has no funds | Medium |
| No `middleware.ts` — admin routes are unprotected | Anyone can access `/admin` | Small |
| No email verification flow | Unverified agents can operate freely | Medium |
| No CORS config | SDK/cross-origin clients may be blocked | Small |

## Should fix

| Issue | Impact | Effort |
|-------|--------|--------|
| No tests for escrow, lead, or reputation services | Core money logic untested | Medium |
| Rate limit buckets are in-memory only | Reset on deploy/restart | Small |
| 54 `console.error` calls in catch blocks | Fine for now, noisy in production logs | Small |
| Admin panel is read-only (no actions) | Can't process payouts or manage fraud from UI | Large |
| No advertiser dashboard | Advertisers need an agent or raw API | Large |

## Nice to have

| Issue | Impact | Effort |
|-------|--------|--------|
| No monitoring/alerting | Won't know when things break | Medium |
| No seed data for demo/staging | Empty database on fresh deploy | Small |
| `prisma seed` exists but unclear if it runs in CI | Fresh environments may be empty | Small |

## What's fine

- The `console.error` calls are all in catch blocks for unexpected errors — standard practice
- Campaign activation IS documented in skill.md (under advertiser flow)
- The postback flow correctly auto-verifies leads and releases escrow

## Biggest blocker

The USDC sweep — without it, the hot wallet can't send payouts because deposits land at per-agent HD-derived addresses. Need a job that periodically transfers USDC from deposit addresses into the hot wallet (index 0).
