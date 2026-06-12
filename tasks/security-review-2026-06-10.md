# AffiliateSwarm Security Review — 2026-06-10

Branch reviewed: `main` @ 2046460. Method: parallel domain audits (auth, authz/IDOR,
financial integrity, webhooks/cron/test endpoints, injection/XSS/SSRF, secrets/config/deps).
Top findings spot-verified against source.

## Critical

- [x] **C1 — Unauthenticated test endpoints can mint balance / trigger payouts in prod.** ✅ PATCHED
      (branch `fix/security-criticals-test-routes-postback-dedup`): shared fail-closed guard
      `src/app/api/test/_guard.ts` — flag must be exactly `1`/`true`, and production additionally
      requires constant-time `x-test-secret` match. Test harness + docker-compose wired.
  `src/app/api/test/credit-wallet/route.ts`, `process-payout`, `process-stripe-checkout`,
  `verify-email`. Only guard is `NODE_ENV==="production" && !ENABLE_TEST_ROUTES` — no auth.
  `ENABLE_TEST_ROUTES` is a truthiness check (any non-empty value, incl `"false"`, enables).
  `docker-compose.app.yml` ships `NODE_ENV=production` + `ENABLE_TEST_ROUTES=1`.
  Fix: require admin auth AND `=== "true"` AND never-in-prod; confirm var unset in prod/preview.

- [x] **C2 — Postback/lead double-payout via check-then-act with no unique constraint.** ✅ PATCHED
      Added `@@unique([campaignId, externalId])` on `Lead` + migration
      `20260610000000_add_lead_campaign_external_id_unique`; `processPostback` now catches P2002 and
      returns the existing lead without placing/releasing a second escrow hold.
  `src/services/tracking.service.ts:182-230` (`processPostback`) and `lead.service.ts:96-149`
  (`submitLead`). `Lead.externalId` is only `@@index`, not `@unique`. Concurrent duplicate
  postbacks both pass the `findFirst` check and both release escrow → affiliate paid N times.
  Fix: add `@@unique([campaignId, externalId])` + upsert/catch P2002 (pattern already used for
  `ChainTransaction.txHash`).

## High

- [ ] **H1 — `GET /api/v1/conversions` has zero authorization scoping.**
  `route.ts:79` calls `listConversions(parsed.data)` without `agent.id`. Any agent reads every
  conversion on the platform (revenue, payout, affiliate names). Scope by agent like `listLeads`.

- [ ] **H2 — `GET /api/v1/leads?affiliateId=X` IDOR.** `lead.service.ts:301-304` unconditionally
  overwrites the self-scope with the caller's `affiliateId` filter (comment says it validates;
  it doesn't). Affiliate A reads affiliate B's leads. Fix: for AFFILIATE callers reject/ignore
  `affiliateId` unless it equals `agentId`.

- [ ] **H3 — Matured-hold double credit (race).** `escrow.service.ts:332-379` reads
  `status==="PENDING_RELEASE"` then updates, no atomic claim. Overlapping cron runs double-credit.
  Fix: guarded `updateMany({where:{id,status:"PENDING_RELEASE"},...})`, act only if count===1.

- [ ] **H4 — Cancel-payout vs send-payout race → double spend.** `escrow.service.ts:866-935`
  cancel path restores wallet without atomic claim while cron `sendPayout` claims same row and
  sends on-chain. Fix: atomic `updateMany` PENDING→CANCELLED, restore only if count===1.

- [ ] **H5 — Admin auth is a single static shared secret used verbatim as the cookie.**
  `src/middleware.ts`, `admin/login/route.ts`. No per-user identity, signing, rotation, or
  revocation; 30-day lifetime. Guards payouts + DB reset. Fix: real admin sessions (random,
  hashed, revocable); never store the secret itself in the cookie.

- [ ] **H6 — No brute-force protection on `verify-code` and `login`.**
  `api/auth/verify-code/route.ts`, `api/auth/login/route.ts`. Login codes looked up globally by
  `code` (not user-scoped), amplifying brute force within the 5-min window. In-memory IP limiter
  (`login-code.ts`) is per-instance and resets on cold start (ineffective on serverless).
  Fix: DB/Redis-backed rate limit + lockout; scope code lookup to a claimed identity.

- [ ] **H7 — Stored XSS in blog rendering.** `src/lib/blog/posts.ts:215` markdown pipeline has no
  `rehype-sanitize`; `javascript:`/`data:` link targets survive and render via
  `dangerouslySetInnerHTML` (`blog/[slug]/page.tsx:158`). Publishable by any `BLOG_API_KEY` holder.
  Fix: add `rehype-sanitize` (GitHub schema) + protocol allow-list at write time.

- [ ] **H8 — SSRF in webhook delivery.** `webhook.service.ts:109` `fetch(url)` with only
  `z.string().url()` validation — no scheme/IP restriction. Agent registers webhook to
  `169.254.169.254` (cloud metadata) / `127.0.0.1` / RFC-1918. Fix: https-only, block
  loopback/link-local/private ranges, re-resolve at request time (DNS rebinding), egress allowlist.

- [ ] **H9 — Outdated Next.js (16.1.7) with App Router middleware/proxy-bypass advisory**
  (GHSA-26hh-7cqf-hhc6) + Server-Component DoS. Middleware is the auth boundary here.
  Fix: upgrade to patched (≥16.2.9), re-run `npm audit`.

## Medium

- [ ] **M1 — Non-constant-time admin/cron secret compares.** All admin API routes
  (`reset-database`, `payouts`, `stats`, `stats/timeseries`, `agents`) use `token === secret`;
  all 5 cron routes use `authHeader !== Bearer ...`. Middleware uses timingSafeEqual but doesn't
  cover `/api/*`. Fix: shared `timingSafeEqual` helper across all admin + cron routes.

- [ ] **M2 — `reset-database` prod escape hatch.** `ALLOW_DB_RESET==="true"` re-enables full table
  truncation under `NODE_ENV=production`; `docker-compose.app.yml` sets it. Fix: never allow in
  prod; gate on explicit non-prod env name.

- [ ] **M3 — Affiliate-controlled `revenueCents` for REV_SHARE.** `lead.service.ts:673-738` +
  postback path compute payout from caller-supplied revenue, no max / no trusted-source check.
  Fix: revenue must come from advertiser's confirmed order, add sane max.

- [ ] **M4 — Budget cap checked against gross `totalDepositedCents`, not net `budgetSpentCents`;**
  lead churn (submit→reject→refund→resubmit) can overshoot intended budget. `escrow.service.ts:78`.

- [ ] **M5 — `verify-deposit` accounting drift.** `chain.service.ts` credits on any USDC transfer
  to the deposit address; sweep records a second INBOUND row not reconciled → ledger vs on-chain
  drift. Dashboard route credits `agents[0]` regardless of type.

- [ ] **M6 — `sameSite:"lax"` + no CSRF token on state-changing/admin POSTs.**

- [ ] **M7 — `viem` → vulnerable `ws` (GHSA-58qx-3vcg-4xpx).** `npm audit fix` (non-breaking).

## Low

- [ ] L1 — Campaign `landingUrl`/`productUrl` accept `javascript:`/internal hosts (`validators/campaign.ts`).
- [ ] L2 — Sessions not revoked on password change; 30-day TTL.
- [ ] L3 — Weak default referral HMAC secret (`tracking.service.ts:15`) — currently unused for auth, latent footgun.
- [ ] L4 — Login code / verify URL logged in dev-mode email branch (`email.ts`).
- [ ] L5 — `.env.production.local` live secrets on dev disk (git-ignored; rotate if shared machine).
- [ ] L6 — Webhook signature embedded in body rather than header; no receiver replay window.
- [ ] L7 — No HSTS header in `next.config.ts` (may be handled at edge — confirm).

## Verified-correct (no action)
Stripe webhook signature + idempotency; Shopify HMAC/JWT/AES-256-GCM crypto; `/api/v1/postback`
HMAC auth; API key bcrypt-12 storage + prefix lookup; `sendPayout`/`processOnchainDeposit` atomic
claims + idempotency; raw SQL is parameterized; per-resource `[id]` routes (wallets, campaigns,
leads, payouts, webhooks, api-keys, notifications) enforce ownership; no committed secrets.
