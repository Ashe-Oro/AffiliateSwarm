# AffiliateSwarm Testing Harnesses

> Last updated: 2026-04-02

---

## Quick Reference

| Harness | Command | Duration | Runs Automatically? |
|---------|---------|----------|---------------------|
| **Unit Tests** | `npm test` | ~2s | Yes — pre-push hook |
| **Smoke Tests** | `npm run smoke:local` | ~5s | Yes — pre-push hook |
| **E2E Fast Path** | `npx playwright test full-lifecycle` | ~15s | Yes — GitHub Actions on PRs touching `src/`, `prisma/`, `tests/e2e/` |
| **E2E Realistic** | `npx playwright test full-journey` | ~25s | Manual |
| **All E2E** | `npm run test:e2e` | ~40s | Manual |
| **Docker Rebuild** | `npm run redeploy:local` | ~30s | Yes — post-commit hook |
| **Script Lint** | `npm run check:scripts` | <1s | Manual |
| **Browser UI QA** | Claude Preview tool or manual checklist | ~30min | Manual (per PR, Claude can automate) |
| **Agent Testing** | Playbook + Claude Preview + API calls | ~1hr per persona | Manual (after skill file changes, partially automatable) |

---

## 1. Unit Tests (Vitest)

**What it is:** Fast, isolated tests for service logic, schema validation, cryptographic functions, and error handling. No database or network required — everything is mocked.

**Command:**
```bash
npm test              # vitest run
npx vitest --watch    # watch mode during development
```

**What it covers (270 tests across 7 files):**

| File | Tests | Scope |
|------|-------|-------|
| `agent.service.test.ts` | ~35 | API key generation, HMAC signing, registration schema |
| `campaign.service.test.ts` | ~50 | Campaign CRUD schemas, field validation, defaults |
| `chain.service.test.ts` | ~60 | Blockchain address validation, transaction simulation |
| `escrow.service.test.ts` | ~40 | Escrow deposits, holds, releases, balance math |
| `lead.service.test.ts` | ~35 | Lead submission, status transitions, postback handling |
| `reputation.service.test.ts` | ~45 | Scoring algorithm, tier calculation, penalties |
| `tracking.service.test.ts` | ~15 | Tracking code generation, URL construction |

**When it runs automatically:** Every `git push` (pre-push hook).

**When to run manually:**
- After changing any service logic in `src/services/`
- After modifying Zod schemas in `src/lib/validators/`
- After updating Prisma models (to check if mocks need updating)
- While developing — use `npx vitest --watch` for instant feedback

**Config:** `vitest.config.ts` — excludes `tests/**`, sets `@` path alias to `./src`.

---

## 2. Smoke Tests (Bash/curl)

**What it is:** Fast HTTP integration test that hits real API endpoints on a running server. Validates the critical path works end-to-end without a browser.

**Command:**
```bash
npm run smoke:local                                          # default: localhost:3000
BASE_URL=http://localhost:3000 ./tests/smoke-test-local.sh   # explicit URL
SMOKE_VERBOSE=1 npm run smoke:local                          # verbose output
```

**What it covers (23 assertions):**
1. Root page reachability (`GET /`)
2. Auth guard enforcement (401 without token)
3. Agent registration (both ADVERTISER and AFFILIATE roles)
4. Email verification via test endpoint
5. Email-gated endpoint enforcement
6. Campaign creation and funding
7. Affiliate application and approval flows
8. Lead submission and tracking codes
9. Analytics and wallet endpoints

**Prerequisites:** Docker app container running on `localhost:3000`. After `git commit`, the post-commit hook rebuilds Docker automatically.

**When it runs automatically:** Every `git push` (pre-push hook, after unit tests).

**When to run manually:**
- After Docker rebuild completes, to sanity-check the build
- After changing API routes or middleware
- As a quick "did I break anything?" check

---

## 3. E2E Tests (Playwright)

### 3a. Fast Path — `full-lifecycle.spec.ts`

**What it is:** Comprehensive end-to-end test covering the entire advertiser-affiliate lifecycle via API calls, then verifying the browser dashboard renders correctly for both roles.

**Command:**
```bash
npx playwright test full-lifecycle
BASE_URL=http://localhost:3099 npx playwright test full-lifecycle  # custom target
gh workflow run e2e                                                # trigger in GitHub Actions
gh workflow run e2e -f test_file=tests/e2e/full-journey.spec.ts    # run a specific file
```

**CI:** Runs automatically via GitHub Actions (`.github/workflows/e2e.yml`) on:
- PRs touching `src/`, `prisma/`, `tests/e2e/`, or `playwright.config.ts`
- Pushes to `main` (post-merge verification)
- Manual dispatch via `gh workflow run e2e`

Skips automatically for pure documentation, config, or test result file changes.

**What it covers (~25 tests, sequential):**

| Phase | Tests | What's Verified |
|-------|-------|-----------------|
| 1. Advertiser Setup | Registration, email verification, identity | Agent created, API key works |
| 2. Campaign | Create, fund (wallet → allocate with 5% platform fee), confirm tracking, activate | Campaign ACTIVE, escrow funded, wallet charged budget + fee |
| 3. Affiliate Setup | Register with profile, discover campaigns, apply, get approved | Tracking code issued |
| 4. Conversions | Follow tracking link, fire postback | Lead VERIFIED, payout credited |
| 5. Payouts | Check balance, request payout, verify completion | Full amount (platform fee is on advertiser at allocation) |
| 6. Error Handling | Double application, activate without funding | Correct error codes |
| 7. Campaign Lifecycle | Pause, resume | Status transitions work |
| 8. Domain Events | Audit trail | Events recorded correctly |
| 9. Advertiser Dashboard | Login, campaigns list, campaign detail, leads, conversions, analytics | All pages render, data visible |
| 10. Affiliate Dashboard | Login, enrolled campaigns, earnings, wallet, reputation | All pages render, data visible |

**Browser dashboard tests (Phases 9-10)** use Playwright's real Chromium browser. The `loginViaBrowser()` helper generates a one-time login code via the API, navigates to `/login`, fills the code, and verifies the redirect lands on the correct dashboard page. Tests then assert that key UI elements are visible — campaign names, KPI cards, table rows, balance displays.

**Funding:** Uses direct escrow deposit for speed.

### 3b. Realistic Path — `full-journey.spec.ts`

**What it is:** Same lifecycle but with browser-based direct tracking links and webhook processing. Closest to production behavior.

**Command:**
```bash
npx playwright test full-journey
```

**Additional coverage beyond fast path:**
- Browser follows the direct tracking URL: click link with `?swarm_ref=` -> mock landing page -> postback
- Uses direct deposit for funding

### 3c. All E2E

```bash
npm run test:e2e       # runs both suites
npm run test:e2e:ui    # interactive Playwright dashboard (great for debugging)
```

**Prerequisites:**
- Dev server running (Playwright auto-starts `npx next dev --port 3099`)
- Database seeded (`npx tsx tests/seed-test-campaign.ts` for `e2e-test.ts`)
- `STRIPE_SECRET_KEY` for full-journey (optional — degrades gracefully)

**When to run manually:**
- Before merging a PR (pre-merge gate)
- After any changes to dashboard pages (`src/app/(dashboard)/`)
- After changes to the tracking/redirect flow
- After changes to the payout or escrow logic

**Config:** `playwright.config.ts` — Chromium only, sequential mode, 30s test timeout, traces on first retry.

---

## 4. Legacy E2E Script — `tests/e2e-test.ts`

**What it is:** Standalone TypeScript E2E test that predates the Playwright suite. Runs pure HTTP requests (no browser) against any server URL.

**Command:**
```bash
npx tsx tests/seed-test-campaign.ts   # one-time setup
npx tsx tests/e2e-test.ts             # default: localhost:3099
npx tsx tests/e2e-test.ts https://affiliateswarm.ai  # against production
```

**What it covers:** Skill files, auth, campaign discovery, affiliate enrollment, click tracking, postback conversions, earnings, analytics, new agent registration, login codes, and error handling.

**When to use:** Quick API-only validation against any environment (local, staging, production). No browser, no Playwright dependency.

---

## 5. Git Hooks

### Post-Commit Hook

**What it does:** Automatically rebuilds the Docker app image after every commit.

**Why:** Catches Dockerfile/build failures immediately. If the Next.js build breaks, you know within 30 seconds instead of finding out at push time.

**Duration:** ~30 seconds.

**What runs:** `./scripts/local-redeploy.sh` — rebuilds Docker image, restarts the app container.

### Pre-Push Hook

**What it does:** Runs unit tests and smoke tests before allowing `git push`.

**Sequence:**
1. `npm test` — unit tests (~2s)
2. `BASE_URL=http://localhost:3000 ./tests/smoke-test-local.sh` — smoke tests (~5s)

**If either fails:** Push is blocked. Fix the issue and push again.

**Duration:** ~7-10 seconds total.

### Installing Hooks

```bash
npm run hooks:install   # symlinks scripts/hooks/* into .git/hooks/
```

Run this once after cloning or if hooks aren't firing.

---

## 6. Manual Testing Scripts

**File:** `tests/manual-test-scripts.md` (793 lines)

Comprehensive curl-based test scripts for manual verification. Useful when you need to test a single endpoint or debug a specific flow without running the full suite.

**Covers:**
- Advertiser journey (12 steps): registration through analytics
- Affiliate journey (17 steps): registration through payout
- Error scenarios (9 cases): duplicate names, bad auth, missing fields, wrong roles, minimum amounts

**When to use:**
- Debugging a specific API endpoint
- Testing against production (`affiliateswarm.ai`)
- Verifying a single fix without running the full suite
- Onboarding — understanding how the API works

---

## 7. Browser UI QA (Claude Preview Tool)

**What it is:** Claude autonomously launches a browser against your local AffiliateSwarm deployment (or Vercel preview URL) and visually tests the web app. This replaces the need for a human to manually click through every dashboard page — Claude does it using the Preview tool built into Claude Code.

**What Claude does:**
1. Spins up a browser pointed at your local deployment (e.g., `http://localhost:3000`)
2. Sets up test data via API calls (registers agents, creates campaigns, funds escrow, confirms tracking, activates)
3. Generates login codes for both advertiser and affiliate accounts
4. Navigates to the login page, enters the code, and logs in
5. Systematically visits every dashboard page and takes screenshots
6. Verifies UI elements are rendering (KPI cards, tables, forms, badges, pagination)
7. Tests interactions (fills forms, clicks buttons, checks error states)
8. Reports pass/fail against the checklist

This is what we did earlier today — Claude logged into both the advertiser and affiliate dashboards on the locally-served AffiliateSwarm instance, walked through the PR #73 UI checklist, and verified each page rendered correctly with real data.

**Checklists:**
- `tests/ui-qa-checklist.md` — Full UI QA checklist (222 lines, covers every dashboard page)
- `tests/agent-testing-playbook.md` — Agent behavior testing (can also be partially automated via browser)

**How to trigger:**
Ask Claude to test the UI against a running instance. Example:
> "AffiliateSwarm is running on localhost:3000. Please walk through the PR #73 test plan and check each dashboard page."

**How to run manually (if preferred):**
Open the app in a browser and walk through `tests/ui-qa-checklist.md`.

**Prerequisites:** A running AffiliateSwarm instance (local Docker on `:3000` or a Vercel preview URL) with test data seeded. For local: `npm run redeploy:local` to ensure Docker is up.

**Full checklist:** `tests/ui-qa-checklist.md` (222 lines)

**What it covers:**

### Advertiser Dashboard
| Page | Key Checks |
|------|-----------|
| `/dashboard/settings` | Profile edit form, API key create/revoke, webhook CRUD, deactivation guard |
| `/dashboard/campaigns/new` | All creation fields render, defaults correct (720h window, 30d hold) |
| `/dashboard/campaigns/[id]` | Edit/delete visibility by status, budget allocation form, max button |
| `/dashboard/leads` | Status filter buttons, pagination, table columns |
| `/dashboard/discover` | Affiliate cards with trust tier, scores, pagination |
| `/dashboard/performance` | Period selector, KPI cards, live status, conversion ledger, pagination |

### Affiliate Dashboard
| Page | Key Checks |
|------|-----------|
| `/affiliate/wallet` | Payout form (CRYPTO/BANK_TRANSFER), amount validation, chain address validation |
| `/affiliate/earnings` | Verified earnings card, by-campaign table, lead filters, payout cancel button |
| `/affiliate/reputation` | Trust tier badge, dimension score bars, peer ratings table |
| `/affiliate/referrals` | Create token form, campaign selector, token list with status badges |

### Cross-Cutting
- Error handling (network disconnect, API errors show meaningful messages)
- Responsiveness (cards stack, tables scroll on narrow viewports)
- Empty states (all tables show "No X yet" when empty)
- Data integrity (dollar formatting, date formatting, badge colors)

**When to run:**
- After any changes to dashboard pages or components
- Before merging a PR that touches UI
- After major API response shape changes (fields renamed, added, removed)
- When a Vercel preview URL is available for a PR

---

## 8. Agent Testing Playbook (AI Conversation Scripts + Browser)

**What it is:** Structured conversation scripts that test how AI agents interact with AffiliateSwarm's skill files. Originally designed for a human tester to walk through manually with a fresh AI agent, but Claude can now execute significant portions of this autonomously — using the Preview tool to test the UI flows (login, dashboard navigation, form submissions) and API calls to validate the backend behavior.

The playbook tests two things:
1. **Skill file quality** — Are the instructions clear enough for an AI agent to follow correctly?
2. **Platform behavior** — Does the app actually work when an agent follows the skill file?

**Full playbook:** `tests/agent-testing-playbook.md` (570 lines)

**What it covers:**

### Advertiser E2E (8 Phases)
| Phase | What's Tested |
|-------|--------------|
| 0. Discovery | Agent reads skill file from URL, saves locally, understands AffiliateSwarm |
| 1. Registration | Correct fields, no premature campaign creation, credentials saved |
| 2. Campaign Creation | Separate from registration, new product fields included, confirmation before creating |
| 3. Funding | Explains Base USDC funding and wallet balance requirements |
| 4. Tracking Setup | Explains redirect model correctly, guides confirm-tracking, doesn't confuse roles |
| 5. Activation | Checks both funding AND tracking before activating |
| 6. Managing Affiliates | Reviews structured application data (profile fields) |
| 7. Analytics & Dashboard | Login code flow (not API key sharing) |
| 8. Daily Operations | Proactively offers check-in |

### Affiliate E2E (11 Phases)
| Phase | What's Tested |
|-------|--------------|
| 0. Discovery | Reads skill file, saves locally |
| 1. Registration | Collects profile fields (audienceSize, channels, etc.) |
| 2. Campaign Discovery | Shows product fields in results |
| 3. Application | Tailored pitch, captures tracking code |
| 4-10. | Post-approval flow, lead submission, earnings, payouts, dashboard, daily ops, deactivation |

### Cross-Agent Interaction (12 Steps)
Two fresh agent sessions interact through the platform — advertiser creates campaign, affiliate discovers and applies, advertiser reviews and approves, conversion fires, both check results.

### Error Handling (9 Scenarios)
Re-registration, wrong-role actions, invalid destinations, insufficient balance, expired credentials, API unavailable, activate without funding/tracking, apply to own campaign.

### Scoring Rubric (90 Points)
10 points each for: discovery, correctness, completeness, safety, error handling, credential management, communication, tracking setup, proactive behavior.

**Known Issues Tracker:** The playbook includes 12 known issues discovered during testing (e.g., `[your product]` placeholder in welcome email, silent activation failures).

**When to run:**
- After any changes to `skills/swarm-advertiser/SKILL.md` or `skills/swarm-affiliate/SKILL.md`
- After adding/changing API endpoints that agents interact with
- After changing field names in request/response schemas
- Periodically (monthly) to check for regression as the platform evolves

---

## 9. Supporting Infrastructure

### Docker (`docker-compose.yml` + `docker-compose.app.yml`)

**Services:**
- **postgres:16-alpine** — database (port `$AFFILIATESWARM_POSTGRES_PORT`, default 5432)
- **redis:7-alpine** — cache (port 6379)
- **app** (overlay) — Next.js production build (port `$AFFILIATESWARM_APP_PORT`, default 3000)

The app container runs with `ENABLE_TEST_ROUTES=1`, which exposes `/api/test/*` endpoints used by smoke tests and E2E (e.g., `/api/test/verify-email` for bypassing real email verification). Because the container runs `NODE_ENV=production`, the mutating test routes also require an `x-test-secret` header matching `TEST_ROUTES_SECRET`. There is **no** committed default — `scripts/bootstrap-local.sh` generates one into `.env` (which Docker Compose loads), and the smoke/e2e suites read the same value, so an exposed instance ships no publicly-known working secret.

### Seed Scripts

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `prisma/seed.ts` | Full database seed (test data) | Bootstrap, fresh Docker |
| `tests/seed-test-campaign.ts` | E2E-specific funded campaign | Before `e2e-test.ts` |
| `scripts/seed-staging.ts` | Staging/prod test data | New environment setup |

### Bootstrap

```bash
npm run bootstrap:local
```

One-command setup: validates prerequisites, creates `.env`, installs deps, starts Docker, runs migrations, seeds database, starts dev server.

---

## 10. Testing Pipeline (How They Fit Together)

```
You write code
    │
    ▼
git commit ──────────► post-commit hook ──► Docker rebuild (~30s)
    │                                           │
    │                                           ▼
    │                                    App running on :3000
    │
    ▼
git push ────────────► pre-push hook (LOCAL GATE)
                           │
                           ├──► npm test (270 unit tests, ~2s)
                           │
                           └──► smoke-test-local.sh (23 checks, ~5s)
                                    │
                                    ▼
                              Push succeeds (or blocked)
                                    │
                                    ▼
                          Open / update PR on GitHub
                                    │
                                    ▼
                     GitHub Actions E2E (CI GATE — automatic)
                           │
                           ├──► Spins up Postgres 16 + Redis 7
                           ├──► Runs Prisma migrations
                           └──► Playwright full-lifecycle (47 tests, ~2min)
                                    │
                                    ▼
                          ✅ PR checks pass → ready for review
                                    │
                                    ▼
                              Merge to main
                                    │
                                    ▼
                     GitHub Actions E2E (POST-MERGE — automatic)
                           │
                           └──► Same Playwright suite re-runs on main
                                to verify the merge didn't break anything
```

### Pipeline layers

| Layer | Where | Trigger | What runs | Blocks |
|-------|-------|---------|-----------|--------|
| **1. Post-commit** | Local | Every `git commit` | Docker rebuild | Nothing (async) |
| **2. Pre-push** | Local | Every `git push` | Unit tests + smoke tests | Push (fails fast) |
| **3. GitHub Actions** | CI | PR touching `src/`, `prisma/`, `tests/e2e/`, `playwright.config.ts`, `package.json` | Playwright E2E with real Postgres + Redis | Merge (PR check) |
| **4. Post-merge** | CI | Push to `main` | Same Playwright E2E | Nothing (verification only) |
| **Manual dispatch** | CI | `gh workflow run e2e` | Playwright E2E (optionally target a specific test file) | Nothing (on-demand) |

The CI gate (layer 3) only triggers on PRs that touch meaningful code paths — pure documentation or config changes skip E2E to keep CI fast.

---

## 11. When You Need to Run Things Manually

Most E2E testing now runs automatically via GitHub Actions on PRs. You only need to run things manually in these situations:

| Situation | What to Run |
|-----------|-------------|
| Just changed service logic | `npm test` |
| Changed an API route | `npm run smoke:local` |
| Changed payment rail integration | `npx playwright test full-journey` |
| Quick check against production | `npx tsx tests/e2e-test.ts https://affiliateswarm.ai` |
| Debugging a single endpoint | Copy the relevant curl from `tests/manual-test-scripts.md` |
| Docker seems broken | `npm run redeploy:local && npm run smoke:local` |
| Changed dashboard UI visually | Ask Claude to test via Preview tool, or walk `tests/ui-qa-checklist.md` manually |
| Changed skill files | Run agent testing playbook (`tests/agent-testing-playbook.md`) — Claude can automate the API + browser portions |
| Run E2E on a specific test file | `gh workflow run e2e -f test_file=tests/e2e/my-test.spec.ts` |
| Re-run E2E on current branch | `gh workflow run e2e` |
| Everything seems broken | `npm run bootstrap:local` (nuclear option) |

> **Note:** Dashboard UI changes, tracking/redirect changes, and pre-merge E2E are now covered automatically by GitHub Actions when you open a PR. The `npx playwright test` and `npm run test:e2e` commands still work locally if you want faster feedback before pushing.

---

## 12. Complete Test Run (One-Liner)

```bash
npm run redeploy:local && npm test && npm run smoke:local && npm run test:e2e
```

Rebuilds Docker, runs all 270 unit tests, runs 23 smoke tests, runs 47 E2E tests. Takes ~90 seconds total.

---

## 13. Document Index

All testing-related files created during this project:

| File | Purpose |
|------|---------|
| `tests/README.md` | This file — main reference for all testing harnesses |
| `tests/manual-test-scripts.md` | Manual curl-based test scripts for advertiser + affiliate journeys |
| `tests/ui-qa-checklist.md` | Browser UI QA checklist (advertiser + affiliate dashboards) |
| `tests/agent-testing-playbook.md` | AI agent conversation scripts with scoring rubric |
| `tests/e2e/` | Playwright E2E test suites (full-lifecycle + full-journey) |
| `tests/e2e-test.ts` | Legacy standalone TypeScript E2E (API-only, any environment) |
| `tests/e2e-staging.ts` | E2E test for staging environments |
| `tests/seed-test-campaign.ts` | Seed funded test campaign for E2E |
| `tests/smoke-test-local.sh` | Bash smoke test script (23 assertions) |
| `docs/local-cicd.md` | Local CI/CD loop documentation (hooks, Docker, bootstrap) |
| `.github/workflows/e2e.yml` | GitHub Actions — Playwright E2E on PRs and manual dispatch |
| `scripts/hooks/post-commit` | Auto-rebuild Docker on commit |
| `scripts/hooks/pre-push` | Unit tests + smoke tests before push |
| `vitest.config.ts` | Unit test configuration |
| `playwright.config.ts` | E2E test configuration |
