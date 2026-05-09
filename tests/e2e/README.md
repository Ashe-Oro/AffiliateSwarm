# Automated E2E Tests (Playwright)

Automated end-to-end tests that exercise the full advertiser + affiliate lifecycle via API calls and browser interactions. These run in CI and locally with `npx playwright test`.

## Test Suites

### `full-lifecycle.spec.ts` — Fast path
- Uses **direct deposits** (bypasses Stripe) for speed
- Covers: registration, campaign creation, funding, activation, affiliate application, approval, lead tracking, payouts, advertiser dispute/chargeback, browser dashboards
- No external dependencies beyond the running Next.js server

### `full-journey.spec.ts` — Realistic path
- Uses **real Stripe checkout** (test mode, card 4242...) + browser-based direct tracking links
- Covers everything in full-lifecycle plus: Stripe payment flow, mock landing page capture, postback callbacks, analytics verification, campaign pause/resume
- Requires `STRIPE_SECRET_KEY` (falls back to direct deposit if not set)

### `helpers.ts` — Shared utilities
API client, agent registration, campaign setup, Stripe helpers, tracking link helpers, postback firing, wallet/analytics queries.

## Running

```bash
# Fast suite only
npx playwright test full-lifecycle

# Realistic suite (needs STRIPE_SECRET_KEY for Stripe tests)
STRIPE_SECRET_KEY=sk_test_... npx playwright test full-journey

# All E2E tests
npx playwright test
```

## Separate from Manual Agent Testing

These are **automated code tests** that validate API correctness and UI rendering.

For **manual QA with AI agents** (testing skill files with brand-new agents that have zero AffiliateSwarm knowledge), see [`agent-testing-playbook.md`](../agent-testing-playbook.md).
