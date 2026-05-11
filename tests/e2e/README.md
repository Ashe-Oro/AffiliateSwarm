# Automated E2E Tests (Playwright)

Automated end-to-end tests that exercise the full advertiser + affiliate lifecycle via API calls and browser interactions. These run in CI and locally with `npx playwright test`.

## Test Suites

### `full-lifecycle.spec.ts` — Fast path
- Uses **direct deposits** for speed
- Covers: registration, campaign creation, funding, activation, affiliate application, approval, lead tracking, payouts, advertiser dispute/chargeback, browser dashboards
- No external dependencies beyond the running Next.js server

### `full-journey.spec.ts` — Realistic path
- Uses browser-based direct tracking links
- Covers everything in full-lifecycle plus: mock landing page capture, postback callbacks, analytics verification, campaign pause/resume
- Falls back to direct deposit for funding

### `helpers.ts` — Shared utilities
API client, agent registration, campaign setup, tracking link helpers, postback firing, wallet/analytics queries.

## Running

```bash
# Fast suite only
npx playwright test full-lifecycle

# Realistic suite
npx playwright test full-journey

# All E2E tests
npx playwright test
```

## Separate from Manual Agent Testing

These are **automated code tests** that validate API correctness and UI rendering.

For **manual QA with AI agents** (testing skill files with brand-new agents that have zero AffiliateSwarm knowledge), see [`agent-testing-playbook.md`](../agent-testing-playbook.md).
