# Testing Harness Plan

Local note for future AffiliateSwarm sessions. This is a planning/handoff doc and should not contain secrets.

Last updated: 2026-05-08

## Recommended Test Lanes

Use three testing lanes so local development stays simple and real integrations are tested only where the correct environment already exists.

## 1. Local Fast Checks: No Secrets

Goal: fast day-to-day confidence without requiring database, CDP, Stripe, Resend, Anthropic, or Vercel env vars.

Commands:

```bash
npm test
npm run check:scripts
```

Current known status:

```txt
Vitest: 49 test files, 560 tests, all passing locally.
Script syntax check: passing locally.
```

Notes:

- `npm test` runs the Vitest suite with mocked services and no database/network requirement.
- This lane should remain the default first check after normal code changes.
- Anthropic is not an application dependency. The only Anthropic usage is an optional legacy Playwright spec, `tests/e2e/skills-agent.spec.ts`, which is skipped unless `ANTHROPIC_API_KEY` is set.

## 2. Local Integration Checks: Local DB, Mock CDP

Goal: run the main browser/API lifecycle locally without Vercel secrets and without real chain operations.

Recommended implementation:

1. Keep the local smoke payload aligned with the public postback contract.
   - `tests/smoke-test-local.sh` confirm-tracking sends `swarm_ref`.
   - `tests/e2e/helpers.ts` also sends `swarm_ref` for confirm and conversion postbacks.
   - Do not reintroduce alternate postback payload field names.

2. Add a script such as:

```txt
scripts/test-e2e-local.sh
```

3. The script should:
   - Start a disposable Postgres container on a non-conflicting port.
   - Set local-only test env vars inside the script.
   - Run `npx prisma migrate deploy`.
   - Run `npx playwright test tests/e2e/full-lifecycle.spec.ts`.
   - Stop/remove the temporary Postgres container.
   - Remove generated Playwright output such as `test-results/` and `playwright-report/`.

Suggested local env values for this script:

```bash
DATABASE_URL="postgresql://affiliateswarm:affiliateswarm_dev@localhost:<port>/affiliateswarm?schema=public"
REDIS_URL="redis://localhost:6379"
BASE_URL="http://localhost:3099"
NEXT_PUBLIC_APP_URL="http://localhost:3099"
NEXT_PUBLIC_SHORT_URL="http://localhost:3099"
NODE_ENV="test"
HMAC_ENCRYPTION_KEY="test-hmac-key-for-ci-0000000000000"
PLATFORM_HD_SEED="test test test test test test test test test test test junk"
ADMIN_SECRET="test-admin-secret-for-ci-00000000"
CRON_SECRET="test-cron-secret-for-ci-000000000"
ALLOW_MOCK_CDP="1"
ENABLE_AFFILIATE_REPUTATION_TAB="true"
ENABLE_AFFILIATE_REFERRALS_TAB="true"
```

Package script to add:

```json
{
  "scripts": {
    "test:e2e:local": "./scripts/test-e2e-local.sh"
  }
}
```

Current known status:

```txt
With a disposable local Postgres and CI-style env, tests/e2e/full-lifecycle.spec.ts passed: 60/60.
```

Warning to address:

```txt
The admin payments page logged BASE_RPC_URL missing during local full-lifecycle, even though assertions passed.
```

Treat this as a harness/app gap to clean up. Either provide a harmless test RPC URL for the local E2E lane or make the admin payments page degrade gracefully when chain read env is absent in local/test mode.

## 3. Remote Preview Checks: Real Vercel Env

Goal: test real integrations only in the Preview environment where Vercel already has the correct env vars.

Use Vercel Preview for:

- Neon Preview database.
- Coinbase CDP on Base Sepolia.
- Real `BASE_RPC_URL`.
- Real `CDP_API_KEY_ID`.
- Real `CDP_API_KEY_PRIVATE_KEY` or `CDP_API_KEY_SECRET`.
- Real `CDP_WALLET_SECRET`.
- Real `ADMIN_SECRET`.
- Real cron and deposit/payout smoke checks.

Recommended Preview chain env:

```txt
CHAIN_NETWORK=base-sepolia
ALLOW_MOCK_CDP=0
```

Recommended Production chain env:

```txt
CHAIN_NETWORK=base
ALLOW_MOCK_CDP=0
CDP_PAYMASTER_URL=<required for Base mainnet sends>
```

Do not require local CDP vars for normal development. Set local CDP vars only when intentionally debugging real Base Sepolia operations from the local app or local Playwright runner.

## Docker Env Recommendation

Current local Docker state:

- `docker-compose.app.yml` passes a container-local `DATABASE_URL`.
- It passes `ADMIN_SECRET` and `CRON_SECRET`, defaulting to local placeholders if unset.
- It does not currently pass CDP vars.
- It defaults `ALLOW_MOCK_CDP` to `1`.

Recommended patch:

```yaml
CHAIN_NETWORK: ${CHAIN_NETWORK:-base-sepolia}
BASE_RPC_URL: ${BASE_RPC_URL:-}
CDP_API_KEY_ID: ${CDP_API_KEY_ID:-}
CDP_API_KEY_PRIVATE_KEY: ${CDP_API_KEY_PRIVATE_KEY:-}
CDP_API_KEY_SECRET: ${CDP_API_KEY_SECRET:-}
CDP_WALLET_SECRET: ${CDP_WALLET_SECRET:-}
CDP_PAYMASTER_URL: ${CDP_PAYMASTER_URL:-}
ALLOW_MOCK_CDP: ${ALLOW_MOCK_CDP:-1}
```

Keep mock CDP as the local Docker default. If real CDP is needed locally, put the values in a local untracked `.env` and set `ALLOW_MOCK_CDP=0`.

## Practical Rule

- Remote Vercel validation: local DB/CDP envs are usually not needed.
- Local dev or local Playwright: set a local/test `DATABASE_URL`.
- Local real CDP testing: set CDP envs locally and use Base Sepolia.
- Local Docker mock testing: no CDP values needed.

Never commit `.env` files or paste secrets into docs.
