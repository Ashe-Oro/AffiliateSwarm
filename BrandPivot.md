# AffiliateSwarm Brand Pivot Plan

This document is the implementation handoff for pivoting the cloned Regatta codebase, hosting, database, and chain/payment infrastructure to AffiliateSwarm.

Do not treat this as a simple string replacement. The codebase has user-facing brand copy, public discovery metadata, docs, emails, agent skill names, cookies, environment variables, tracking parameters, fresh database setup, Vercel project configuration, cron jobs, and new Coinbase CDP wallet state that need different migration strategies.

## Target Brand

- Product display name: `AffiliateSwarm`
- Public domain: `https://affiliateswarm.ai`
- Domain in prose: `AffiliateSwarm.ai`
- Lowercase/internal slug where needed: `affiliateswarm`
- Affiliate skill name: `swarm-affiliate`
- Advertiser skill name: `swarm-advertiser`
- Affiliate skill folder: `skills/swarm-affiliate`
- Advertiser skill folder: `skills/swarm-advertiser`
- Agent/user config directory: `~/.config/affiliateswarm`

## Infrastructure Target

- GitHub repository: `Ashe-Oro/AffiliateSwarm`
- Hosting platform: Vercel
- Production domain: `affiliateswarm.ai`
- Optional canonical redirect: `www.affiliateswarm.ai` -> `affiliateswarm.ai`
- Production app URL env: `NEXT_PUBLIC_APP_URL=https://affiliateswarm.ai`
- Production short URL env: `NEXT_PUBLIC_SHORT_URL=https://affiliateswarm.ai`, unless a separate short domain is chosen
- Production chain network: `CHAIN_NETWORK=base`
- Preview/staging chain network: `base-sepolia` or mock CDP, never production CDP against preview data
- Database: create a fresh AffiliateSwarm production Postgres database
- Coinbase CDP: create fresh AffiliateSwarm CDP credentials, wallet secret, RPC URL, and paymaster configuration
- Old Regatta domain: not preserved
- Old Regatta wallets/funds: not preserved

## Fresh Deployment Assumption

This plan assumes AffiliateSwarm is a fresh production deployment:

- No existing Regatta production database will be restored.
- No existing Regatta Coinbase CDP wallets or funds will be preserved.
- No existing `regatta.network` domain will be migrated or redirected as part of this plan.
- No existing users, sessions, API keys, advertiser integrations, or tracking/postback contracts need to be preserved.
- Public integration contracts should be renamed cleanly for AffiliateSwarm rather than kept as Regatta compatibility aliases.
- The implementer should create all production secrets from scratch.
- The implementer may remove or rename legacy custody/account names because there are no old wallets to preserve, but must do that before the first production CDP-funded deployment.

## Explicit MCP Decommission Scope

The initial plan treated MCP package work as out of scope. That is superseded by the later product decision to decommission MCP server onboarding entirely. AffiliateSwarm should use role-specific skill files plus the REST API as the supported agent integration path.

Remove supported-entry-point behavior under:

```txt
mcp-server/**
src/mcp/**
src/sdk/**
```

Do not publish or promote an MCP server package. Remove active MCP docs, docs routes, scripts, package metadata, and generated package artifacts from the app.

The legacy TypeScript SDK source should also be removed rather than rebranded; agents should integrate through skill files and the REST API.

## Starting Inventory

Before editing, run a full inventory in the AffiliateSwarm repo:

```bash
rg -n --hidden \
  --glob '!.git/**' \
  --glob '!node_modules/**' \
  -i 'regatta|regatta\.network|REGATTA_|x-regatta|rgt_live_|rgt_test_|rgta_ref|regatta_session|regatta_admin_token|regatta_ref'

find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  \( -iname '*regatta*' -o -iname '*Regatta*' \) -print
```

Classify every hit into one of these buckets:

- User-facing product copy
- Domain, email, SEO, and public discovery metadata
- External integration contract
- Agent skill content/metadata
- Cookie/session/internal auth
- Env vars and deployment config
- Seed/demo/test data
- Historical docs
- Assets and filenames
- Removed MCP server leftovers
- Removed SDK leftovers

## Recommended Migration Strategy

Use a staged approach:

1. Add central brand constants.
2. Update visible UI, metadata, docs, and emails.
3. Rename skill folders and skill metadata to `swarm-affiliate` and `swarm-advertiser`.
4. Update public discovery/sitemap/robots/API catalog.
5. Rename external contract names to AffiliateSwarm-native values because this is a fresh launch with no users or integrations to preserve.
6. Prepare Vercel, database, and CDP migration/cutover.
7. Update tests and fixtures.
8. Run final searches and remove accidental stale Regatta references.

## Brand Constants

Create a central brand module, for example `src/lib/brand.ts`, and use it where practical.

Suggested constants:

```ts
export const PRODUCT_NAME = "AffiliateSwarm";
export const PRODUCT_DOMAIN = "affiliateswarm.ai";
export const DEFAULT_APP_URL = "https://affiliateswarm.ai";
export const SUPPORT_EMAIL = "support@affiliateswarm.ai";
export const LEGAL_EMAIL = "legal@affiliateswarm.ai";
export const PRIVACY_EMAIL = "privacy@affiliateswarm.ai";
export const NOREPLY_EMAIL = "noreply@affiliateswarm.ai";
export const FROM_EMAIL = "AffiliateSwarm <noreply@affiliateswarm.ai>";
export const TRACKING_PARAM = "swarm_ref";
export const API_KEY_PREFIX = "swarm_live_";
export const TEST_API_KEY_PREFIX = "swarm_test_";
export const SESSION_COOKIE = "affiliateswarm_session";
export const ADMIN_COOKIE = "affiliateswarm_admin_token";
export const PARTNER_REF_COOKIE = "affiliateswarm_ref";
```

Then replace hard-coded values in app metadata, email, discovery, docs routes, sitemap, robots, and tests where it is straightforward.

Important existing hard-coded locations include:

```txt
src/lib/public-discovery.ts
src/lib/agent-skills.ts
src/lib/email.ts
src/app/layout.tsx
next.config.ts
```

## Visible Product Rebrand

Replace user-facing `Regatta` with `AffiliateSwarm` and `regatta.network` with `affiliateswarm.ai`.

Primary files and areas:

```txt
src/app/layout.tsx
src/app/page.tsx
src/components/marketing/navbar.tsx
src/components/marketing/footer.tsx
src/components/marketing/agent-onboarding.tsx
src/app/dashboard/layout.tsx
src/app/affiliate/layout.tsx
src/app/admin/layout.tsx
src/app/(auth)/login/page.tsx
src/app/(auth)/onboarding/page.tsx
src/app/(marketing)/**
src/components/dashboard/**
src/components/affiliate/**
src/components/admin/**
```

Examples:

```txt
Regatta - Agent-First Affiliate Marketing
-> AffiliateSwarm - Agent-First Affiliate Marketing

Regatta dashboard
-> AffiliateSwarm dashboard

Regatta Admin
-> AffiliateSwarm Admin

The Regatta team
-> The AffiliateSwarm team
```

Be careful with CSS class names such as `.regatta-prose`. If they are purely internal and scoped, they can be renamed to `.affiliateswarm-prose`, but only update both the class usage and stylesheet together.

## Domain, SEO, And Public Discovery

Update public URLs and generated metadata to use `https://affiliateswarm.ai`.

Important files:

```txt
src/lib/public-discovery.ts
src/lib/agent-skills.ts
next.config.ts
src/app/sitemap.xml/route.ts
src/app/sitemap.xml/__tests__/route.test.ts
src/app/robots.txt/route.ts
src/app/robots.txt/__tests__/route.test.ts
src/app/blog.xml/route.ts
src/app/.well-known/api-catalog/route.ts
src/app/.well-known/api-catalog/__tests__/route.test.ts
src/app/.well-known/agent-skills/index.json/route.ts
src/app/.well-known/agent-skills/index.json/__tests__/route.test.ts
```

Expected generated/public values:

```txt
https://affiliateswarm.ai
https://affiliateswarm.ai/docs/api
https://affiliateswarm.ai/api/health
https://affiliateswarm.ai/.well-known/api-catalog
https://affiliateswarm.ai/.well-known/agent-skills/index.json
https://affiliateswarm.ai/affiliate/skill.md
https://affiliateswarm.ai/advertiser/skill.md
```

Publisher metadata should become:

```json
{
  "name": "AffiliateSwarm",
  "url": "https://affiliateswarm.ai"
}
```

Update Link header titles, OpenGraph site name/title/alt text, Twitter card title, metadataBase, sitemap assertions, robots sitemap URL, and API catalog tests.

## Agent Skill Rebrand

Rename skill folders:

```bash
git mv skills/regatta-affiliate skills/swarm-affiliate
git mv skills/regatta-advertiser skills/swarm-advertiser
```

Update `skills/swarm-affiliate/SKILL.md` frontmatter:

```yaml
name: swarm-affiliate
description: Register as an affiliate on the AffiliateSwarm marketplace (affiliateswarm.ai), discover and apply to campaigns, submit leads, track commissions through the holding period, and request USDC payouts on Base.
```

Update `skills/swarm-advertiser/SKILL.md` frontmatter:

```yaml
name: swarm-advertiser
description: Register an advertiser on the AffiliateSwarm affiliate marketplace (affiliateswarm.ai), create flat-fee or percent-of-sale campaigns, fund a wallet, confirm postback tracking, and manage affiliate applications.
```

Update all skill content:

```txt
Regatta -> AffiliateSwarm
regatta.network -> affiliateswarm.ai
https://regatta.network/api/v1 -> https://affiliateswarm.ai/api/v1
~/.config/regatta -> ~/.config/affiliateswarm
regatta-affiliate -> swarm-affiliate
regatta-advertiser -> swarm-advertiser
```

Keep public skill URLs generic unless there is a product decision to change them:

```txt
/affiliate/skill.md
/advertiser/skill.md
```

Update `src/lib/agent-skills.ts`:

```ts
const agentSkillDefinitions = [
  {
    slug: "affiliate",
    name: "swarm-affiliate",
    description:
      "Affiliate agent instructions for registering on AffiliateSwarm, discovering campaigns, applying, submitting leads, tracking commissions, and requesting USDC payouts.",
    filePath: "skills/swarm-affiliate/SKILL.md",
    urlPath: "/affiliate/skill.md",
    audience: "affiliate_agents",
  },
  {
    slug: "advertiser",
    name: "swarm-advertiser",
    description:
      "Advertiser agent instructions for registering on AffiliateSwarm, creating campaigns, funding a wallet, confirming tracking, and managing affiliate applications.",
    filePath: "skills/swarm-advertiser/SKILL.md",
    urlPath: "/advertiser/skill.md",
    audience: "advertiser_agents",
  },
];
```

Update tests expecting:

```txt
regatta-affiliate -> swarm-affiliate
regatta-advertiser -> swarm-advertiser
https://regatta.network/... -> https://affiliateswarm.ai/...
```

## Emails And Legal Pages

Update sender and branded email copy.

Important files:

```txt
src/lib/email.ts
src/lib/notifications/emails.ts
src/app/(marketing)/terms/page.tsx
src/app/(marketing)/privacy/page.tsx
docs/email-notifications.md
```

Replace:

```txt
Regatta <noreply@regatta.network>
-> AffiliateSwarm <noreply@affiliateswarm.ai>

privacy@regatta.network
-> privacy@affiliateswarm.ai

legal@regatta.network
-> legal@affiliateswarm.ai

support@regatta.network
-> support@affiliateswarm.ai
```

Email bodies should say `Welcome to AffiliateSwarm`, `AffiliateSwarm dashboard`, and `The AffiliateSwarm team`.

## External Integration Contracts

Because AffiliateSwarm has no current users, sessions, API keys, advertiser postback integrations, or public tracking links, rename the public integration contracts cleanly. Do not keep legacy Regatta compatibility aliases unless a future operator explicitly requests a backwards-compatible migration.

Replace these contracts:

```txt
rgta_ref -> swarm_ref
rgt_live_ -> swarm_live_
rgt_test_ -> swarm_test_
REGATTA_API_KEY -> AFFILIATESWARM_API_KEY
REGATTA_REFERRAL_SECRET -> AFFILIATESWARM_REFERRAL_SECRET
X-Regatta-Key-Id -> X-AffiliateSwarm-Key-Id
X-Regatta-Timestamp -> X-AffiliateSwarm-Timestamp
X-Regatta-Signature -> X-AffiliateSwarm-Signature
regatta_session -> affiliateswarm_session
regatta_admin_token -> affiliateswarm_admin_token
regatta_ref -> affiliateswarm_ref
```

Update generated examples, docs, tests, request validation, CORS headers, cookies, and local setup scripts to use the new names directly.

### Tracking Parameter

New public tracking parameter:

```txt
swarm_ref
```

Recommendation: replace `rgta_ref` everywhere with `swarm_ref`. Since there are no existing advertiser integrations, do not accept `rgta_ref` in postbacks and do not generate it in tracking links.

Implementation areas:

```txt
src/lib/validators/tracking.ts
src/lib/tracking-url.ts
src/services/tracking.service.ts
src/app/t/[trackingCode]/route.ts
src/app/api/v1/postback/route.ts
src/components/dashboard/tracking-confirmation-card.tsx
src/app/(marketing)/docs/integration/page.tsx
src/app/(marketing)/docs/tracking/page.tsx
src/app/(marketing)/docs/architecture/page.tsx
```

Expected request shape:

```json
{ "swarm_ref": "abc123", "externalId": "order_123" }
```

Generated tracking links should append `?swarm_ref=<code>`.

### API Key Prefixes

New key prefixes:

```txt
swarm_live_
swarm_test_
```

Recommendation: mint `swarm_live_` keys for production credentials and route `swarm_test_` keys to sandbox/test infrastructure where that feature is used. Do not accept or document `rgt_live_` or `rgt_test_` outside intentionally historical/ignored files.

Implementation areas:

```txt
src/lib/auth/api-keys.ts
src/lib/prisma.ts
src/services/agent.service.ts
src/services/__tests__/agent.service.test.ts
src/app/api/v1/agents/__tests__/agents.test.ts
docs/**/*.md
tests/**
```

### Environment Variables

Introduce new env names and remove Regatta fallbacks outside removed MCP server and SDK paths.

Recommended mapping:

```txt
REGATTA_API_KEY -> AFFILIATESWARM_API_KEY
REGATTA_REFERRAL_SECRET -> AFFILIATESWARM_REFERRAL_SECRET
REGATTA_AGENT_ID -> no supported MCP replacement; use API keys and skill files instead
REGATTA_POSTGRES_PORT -> AFFILIATESWARM_POSTGRES_PORT
REGATTA_REDIS_PORT -> AFFILIATESWARM_REDIS_PORT
REGATTA_APP_PORT -> AFFILIATESWARM_APP_PORT
```

Example:

```ts
const referralSecret =
  process.env.AFFILIATESWARM_REFERRAL_SECRET ?? "affiliateswarm-dev-secret";
```

Update:

```txt
.env.example
docker-compose.yml
docker-compose.app.yml
scripts/bootstrap-local.sh
.github/workflows/e2e.yml
tests/README.md
docs/**/*.md
```

### HMAC Headers

Current headers:

```txt
X-Regatta-Key-Id
X-Regatta-Timestamp
X-Regatta-Signature
```

Recommendation: replace old headers with the new headers.

New headers:

```txt
X-AffiliateSwarm-Key-Id
X-AffiliateSwarm-Timestamp
X-AffiliateSwarm-Signature
```

Implementation areas:

```txt
src/lib/auth/hmac.ts
src/lib/auth/middleware.ts
next.config.ts
docs/api-reference.md
src/app/(marketing)/docs/api/page.tsx
tests
```

In CORS `Access-Control-Allow-Headers`, include only the new `X-AffiliateSwarm-*` names alongside standard headers.

### Cookies

Current cookies:

```txt
regatta_session
regatta_admin_token
regatta_ref
```

New cookies:

```txt
affiliateswarm_session
affiliateswarm_admin_token
affiliateswarm_ref
```

Recommendation: read and write only the new cookies. There are no current users, so no session/referral cookie migration is required.

Implementation areas:

```txt
src/lib/auth/session.ts
src/middleware.ts
src/app/api/admin/login/route.ts
src/app/api/admin/agents/route.ts
src/app/api/admin/payouts/route.ts
src/app/api/admin/reset-database/route.ts
src/app/api/admin/stats/route.ts
src/app/api/admin/stats/timeseries/route.ts
src/app/r/[code]/route.ts
src/app/page.tsx
src/app/(marketing)/for-advertisers/page.tsx
src/app/(marketing)/for-affiliates/page.tsx
tests/e2e/helpers.ts
tests
```

## Seed Data And Internal Campaign

Update platform-owned seed data and scripts.

Important files:

```txt
prisma/seed.ts
scripts/ensure-regatta-campaign.ts
```

Rename script:

```txt
scripts/ensure-regatta-campaign.ts
-> scripts/ensure-affiliateswarm-campaign.ts
```

Update references:

```txt
Regatta advertiser account -> AffiliateSwarm advertiser account
Grow Regatta -> Grow AffiliateSwarm
https://regatta.network -> https://affiliateswarm.ai
https://regatta.network/logo.png -> new AffiliateSwarm logo URL
```

Example campaign name:

```txt
Grow AffiliateSwarm - Refer Advertisers & Affiliates
```

Example description:

```txt
Earn commissions by referring new advertisers and affiliates to AffiliateSwarm. When someone you refer signs up and generates revenue on the platform, you earn a share. This is AffiliateSwarm's own referral campaign - help us grow the network.
```

## Assets

Current branded assets include:

```txt
public/regatta-logo.jpg
public/og-image.jpg
public/icon-192.png
public/icon-512.png
public/apple-touch-icon.png
public/favicon-16x16.png
public/favicon-32x32.png
src/app/favicon.ico
images/regatta-logo-1.jpg
images/regatta-x-banner2.jpg
```

Recommended new names:

```txt
public/affiliateswarm-logo.jpg
images/affiliateswarm-logo-1.jpg
images/affiliateswarm-x-banner.jpg
```

Update references in:

```txt
src/components/marketing/navbar.tsx
src/app/dashboard/layout.tsx
src/app/affiliate/layout.tsx
src/app/layout.tsx
```

Also replace OG image, favicons, icon files, and apple touch icon with AffiliateSwarm-branded assets.

If new assets are not available during implementation, keep existing file names temporarily but update alt text and UI text. Add a follow-up note for asset replacement.

## Docker, Env, CI, And Local Setup

Update local database names and examples where it does not create unnecessary churn.

Important files:

```txt
.env.example
docker-compose.yml
docker-compose.app.yml
.github/workflows/e2e.yml
scripts/bootstrap-local.sh
scripts/demo-complete-setup.sh
tests/README.md
```

Suggested local values:

```txt
POSTGRES_USER: affiliateswarm
POSTGRES_PASSWORD: affiliateswarm_dev
POSTGRES_DB: affiliateswarm
DATABASE_URL="postgresql://affiliateswarm:affiliateswarm_dev@localhost:5432/affiliateswarm?schema=public"
SANDBOX_DATABASE_URL="postgresql://user:pass@host:5432/affiliateswarm_sandbox"
```

If changing DB names breaks local workflows too broadly, it is acceptable to keep old local DB credentials in Docker for now and only rebrand comments/docs. Product-facing behavior matters more than local container naming.

## Hosted Infrastructure: Vercel, Database, And Coinbase CDP

This pivot includes production infrastructure, not just repo text. Treat the hosted migration as a separate release phase with a rollback path.

### Vercel Project Migration

Create or configure a Vercel project for the `Ashe-Oro/AffiliateSwarm` GitHub repository.

Recommended Vercel project settings:

```txt
Project name: affiliateswarm
Framework preset: Next.js
Root directory: repository root
Install command: npm install
Build command: npm run build
Output: Next.js default / standalone from next.config.ts
Production branch: master, or the chosen release branch for the new repo
```

Domain setup:

```txt
affiliateswarm.ai -> Vercel production deployment
www.affiliateswarm.ai -> redirect to affiliateswarm.ai, unless marketing wants www canonical
```

DNS setup depends on the registrar, but the usual Vercel shape is:

```txt
A record for apex affiliateswarm.ai -> Vercel's apex IP
CNAME for www.affiliateswarm.ai -> cname.vercel-dns.com
```

Use the exact records Vercel shows for the project. Do not guess if Vercel gives different instructions.

Old-domain handling:

- There is no old-domain migration for this plan.
- Do not spend launch time preserving `regatta.network` redirects.
- If stale code/docs mention `regatta.network`, update them to `affiliateswarm.ai` unless they are explicitly historical.

Vercel crons are declared in `vercel.json`:

```txt
/api/cron/sweep              every 5 minutes
/api/cron/process-holds      every 5 minutes
/api/cron/detect-deposits    every 2 minutes
/api/cron/email-retry-sweep  every 5 minutes
/api/cron/process-payouts    every 5 minutes
```

Critical cron rule:

- Because this is a fresh deployment, there is no data-preserving cron cutover.
- Still verify that the new Vercel project points only at the new AffiliateSwarm database and new CDP credentials before enabling crons.
- Confirm `CRON_SECRET` is set in the new Vercel project and that Vercel Cron is sending `Authorization: Bearer $CRON_SECRET`, because every cron route expects that bearer token.

Recommended Vercel environment variable environments:

- Production: real production DB, real Base mainnet CDP, real Resend, real domain.
- Preview: preview DB or sandbox DB, Base Sepolia or mock CDP, test email provider where possible.
- Development: local or dev DB, Base Sepolia or mock CDP.

Do not point Vercel Preview deployments at production `DATABASE_URL`, production CDP credentials, or production payment webhook secrets unless there is an explicit emergency reason.

### Vercel Environment Variables

Set the production env vars in the AffiliateSwarm Vercel project. Use Vercel's encrypted environment variable store, not committed files.

Core app:

```txt
DATABASE_URL
NEXT_PUBLIC_APP_URL=https://affiliateswarm.ai
NEXT_PUBLIC_SHORT_URL=https://affiliateswarm.ai
NODE_ENV=production
HMAC_ENCRYPTION_KEY
ADMIN_SECRET
CRON_SECRET
PLATFORM_FEE_RATE
NEXT_PUBLIC_PLATFORM_FEE_RATE
```

Database/sandbox:

```txt
SANDBOX_DATABASE_URL, if sandbox API keys or test routing are still supported
```

Email:

```txt
RESEND_API_KEY
```

Chain/CDP:

```txt
CHAIN_NETWORK=base
BASE_RPC_URL
CDP_API_KEY_ID
CDP_API_KEY_PRIVATE_KEY, or CDP_API_KEY_SECRET
CDP_WALLET_SECRET
CDP_PAYMASTER_URL
```

Brand-pivot env names:

```txt
AFFILIATESWARM_REFERRAL_SECRET
AFFILIATESWARM_POSTGRES_PORT, local/dev only
AFFILIATESWARM_REDIS_PORT, local/dev only
AFFILIATESWARM_APP_PORT, local/dev only
```

Because this is a fresh deployment, generate new values for every secret and do not set legacy `REGATTA_*` names in production:

- Generate a new `HMAC_ENCRYPTION_KEY`.
- Generate a new `ADMIN_SECRET`.
- Generate a new `CRON_SECRET`.
- Generate new CDP credentials and `CDP_WALLET_SECRET`.
- Keep card/bank processor credentials unset until that rail is explicitly enabled.
- Generate or configure new Resend/domain credentials for `affiliateswarm.ai`.

Old `REGATTA_*` fallbacks should not be needed outside removed MCP server and SDK paths. Prefer documenting and setting new `AFFILIATESWARM_*` names only.

### Database Setup Strategy

Use a clean production database. Do not restore Regatta data.

High-level steps:

1. Choose the production Postgres provider. Vercel Postgres, Neon, Supabase, Railway, or another managed Postgres provider can work as long as Prisma can connect reliably.
2. Create a new production database for AffiliateSwarm.
3. Create a separate preview/staging database if previews will run API flows.
4. Set the production `DATABASE_URL` in Vercel Production.
5. Set preview/development database URLs separately; do not reuse production for previews.
6. Run Prisma migrations against the fresh production database:

```bash
npx prisma migrate deploy
```

7. Run the rebranded seed script only if production should start with seed campaigns/platform accounts.
8. Verify `/api/health` and basic auth/API flows against the fresh DB.

Fresh database means these old Regatta rows are intentionally not copied:

```txt
users and sessions
agents
api credentials and HMAC secrets
campaigns
affiliate applications
tracking codes
leads and conversions
wallets
escrow accounts and escrow holds
ledger entries
payout requests
chain transactions
checkout sessions
webhook subscriptions
```

Seed-data note:

- If the app needs a platform-owned advertiser or "Grow AffiliateSwarm" campaign, create it through the rebranded seed path.
- Do not keep "Grow Regatta" seed data in a fresh production DB.
- Fresh launch means no existing API keys survive; every user/agent will register again and receive new keys.

### Database URL And Pooling

The app uses Prisma with Postgres. The production `DATABASE_URL` should point to the normal application connection string.

If the database provider offers both pooled and direct URLs:

- Use the provider-recommended pooled URL for app runtime if compatible with Prisma's adapter.
- Use the direct URL for migrations if required by the provider.
- Document both in Vercel env if needed, but avoid inventing new env names unless the code reads them.

Before launch, test:

```bash
npx prisma migrate deploy
npm run build
```

against the same env shape Vercel Production will use.

### Coinbase CDP Migration

The app uses Coinbase CDP for Base smart accounts and USDC transfers.

Relevant runtime variables:

```txt
CHAIN_NETWORK
BASE_RPC_URL
CDP_API_KEY_ID
CDP_API_KEY_PRIVATE_KEY, or CDP_API_KEY_SECRET
CDP_WALLET_SECRET
CDP_PAYMASTER_URL
```

Relevant code:

```txt
src/lib/chain/config.ts
src/lib/chain/cdp.ts
src/lib/chain/wallet.ts
src/lib/chain/usdc.ts
src/app/api/cron/detect-deposits/route.ts
src/app/api/cron/sweep/route.ts
src/app/api/cron/process-payouts/route.ts
```

CDP account naming details:

- Agent smart accounts are named from a stable hash of the agent ID: `agent-<hash>`.
- Platform hot smart account name is now `swarm-hot`.
- Platform hot smart account owner is now `swarm-owner`.

Because this is a fresh deployment with no old production funds, the old `platform-hot` / `regatta-owner` Base Sepolia test account can be abandoned.

Implemented code change before production CDP use:

```ts
export const PLATFORM_HOT_ACCOUNT_NAME = "swarm-hot";
export const PLATFORM_HOT_OWNER_ACCOUNT_NAME = "swarm-owner";
```

Important CDP nuance:

- If `platform-hot` does not exist yet in the target CDP project, changing only `PLATFORM_HOT_OWNER_ACCOUNT_NAME` is sufficient.
- If `platform-hot` already exists with owner `regatta-owner`, changing only `PLATFORM_HOT_OWNER_ACCOUNT_NAME` can fail with a CDP owner-mismatch error because the SDK fetches smart accounts by name and validates the supplied owner.
- In the current AffiliateSwarm Preview smoke test, `platform-hot` was already created with `regatta-owner`; because only Base Sepolia test funds were used, it is safe to abandon that test hot account for the real rebrand if desired.
- For a clean production rebrand with no funds to preserve, rename both `PLATFORM_HOT_ACCOUNT_NAME` and `PLATFORM_HOT_OWNER_ACCOUNT_NAME` before any production funds are sent.

Only do this before the first funded production deployment. Once real funds are sent to the platform hot wallet, treat CDP account names, smart-account addresses, and wallet secret as custody-critical state.

Implementation checklist for the platform hot CDP rename:

1. Edit `src/lib/chain/cdp.ts`:

```ts
export const PLATFORM_HOT_ACCOUNT_NAME = "swarm-hot";
export const PLATFORM_HOT_OWNER_ACCOUNT_NAME = "swarm-owner";
```

2. Update nearby comments in `src/lib/chain/wallet.ts` and `src/lib/chain/cdp.ts` so they no longer describe `regatta-owner` as the intended long-term owner.
3. Update unit tests that assert the old platform hot account/owner naming, especially `src/lib/chain/__tests__/wallet.test.ts` and any mocks using `platform-hot` or `regatta-owner`.
4. Redeploy Preview with Base Sepolia CDP credentials after the rename.
5. Register a fresh throwaway advertiser in Preview and confirm the app creates a custodial deposit address.
6. Send a small Base Sepolia USDC deposit to that address.
7. Run or wait for `/api/cron/detect-deposits` and verify the deposit is credited.
8. Run or wait for `/api/cron/sweep` and verify the sweep sends from the advertiser deposit smart account to the new `swarm-hot` platform hot smart account.
9. Record the new platform hot smart account address in the deployment runbook before enabling production funds.
10. Only after the renamed Preview flow is verified, deploy the rename to Production.

If production funds have already reached the old `platform-hot` account, do not rename blindly. Either keep the existing constants until those funds are swept/preserved, or create an explicit migration that transfers funds from the old hot account before switching names.

Fresh CDP setup:

1. Create a new Coinbase CDP project for AffiliateSwarm, or a clearly separated project/account namespace in an existing Coinbase account.
2. Create a production CDP API key.
3. Generate a new `CDP_WALLET_SECRET`.
4. Store `CDP_API_KEY_ID`, `CDP_API_KEY_PRIVATE_KEY` or `CDP_API_KEY_SECRET`, and `CDP_WALLET_SECRET` in Vercel Production.
5. Provision a Base mainnet RPC URL and set `BASE_RPC_URL`.
6. Provision `CDP_PAYMASTER_URL` for Base mainnet.
7. Use Base Sepolia or mock CDP for preview/staging.
8. Run a small CDP smoke test on Base Sepolia before enabling mainnet production flows.
9. Switch production to `CHAIN_NETWORK=base` only when paymaster, RPC, and CDP credentials are verified.

Base mainnet requirements:

- `CHAIN_NETWORK=base`
- `BASE_RPC_URL` must be a working Base mainnet RPC URL.
- `CDP_PAYMASTER_URL` is required on mainnet by `src/lib/chain/usdc.ts`.
- The platform hot wallet must have access to any USDC it is expected to sweep or pay out.

Base Sepolia/staging requirements:

- `CHAIN_NETWORK=base-sepolia`
- Sepolia-compatible `BASE_RPC_URL`
- CDP credentials for a test project or test-safe account namespace
- `CDP_PAYMASTER_URL` can be absent because the code treats testnet as automatically sponsored

CDP verification checklist:

- App starts in production mode without "CDP credentials missing".
- `getPlatformAccount()` creates or returns the new AffiliateSwarm platform hot smart account.
- `getUsdcBalance(platformHotAddress)` succeeds.
- A new test agent can get a deposit address.
- On Base Sepolia, faucet/test deposit flow works.
- On Base mainnet, do not perform a real transfer until balances, paymaster, and idempotency behavior are verified.
- Once a mainnet smart account receives funds, do not rotate `CDP_WALLET_SECRET` or rename its CDP account owner without a custody migration plan.

### Payment And Webhook Setup

Although the requested scope is Vercel, database, and CDP, the production app also depends on Resend. Card and bank payment rails remain feature-flagged off for the USDC launch.

Card/bank rail:

- Leave processor credentials unset until this rail is explicitly enabled.
- Keep webhook configuration disabled while Base USDC is the only live funding and payout rail.
- Verify success/cancel URLs use `affiliateswarm.ai` before enabling this rail later.

Resend/email:

- Verify `affiliateswarm.ai` is added and DNS-verified in Resend, or whichever email provider is used.
- Set SPF/DKIM/DMARC records for the new domain.
- Confirm emails can send from `noreply@affiliateswarm.ai`.

### Fresh Production Launch Runbook

Recommended runbook for the fresh AffiliateSwarm deployment:

1. Finish and merge/test the AffiliateSwarm rebrand code.
2. Create AffiliateSwarm Vercel project linked to `Ashe-Oro/AffiliateSwarm`.
3. Create a fresh AffiliateSwarm production Postgres database.
4. Create a separate preview/staging database if preview flows will be tested.
5. Create fresh production secrets: `HMAC_ENCRYPTION_KEY`, `ADMIN_SECRET`, `CRON_SECRET`.
6. Create/configure fresh Resend credentials for AffiliateSwarm; leave optional card/bank processor credentials disabled.
7. Create/configure fresh Coinbase CDP production credentials, wallet secret, Base RPC URL, and paymaster URL.
8. Configure Vercel Production env vars.
9. Configure Vercel Preview env vars with safe preview DB and Base Sepolia/mock CDP.
10. Run `npx prisma migrate deploy` against the fresh production DB.
11. Run rebranded production seed setup only if desired.
12. Verify preview build with sandbox/mock infrastructure.
13. Verify production build and `/api/health`.
14. Verify login/signup on production with a test account.
15. Verify a new API key can be generated and used.
16. Verify CDP creates a new test deposit address in the intended environment.
17. Verify Base USDC deposit detection and Resend domain.
18. Add/verify Vercel domains for `affiliateswarm.ai`.
19. Enable/monitor AffiliateSwarm crons.
20. Watch logs for `detect-deposits`, `sweep`, `process-holds`, `process-payouts`, and `email-retry-sweep`.

Rollback plan:

- Because there is no old production data or domain to preserve, rollback means disabling the new Vercel deployment, fixing configuration/code, and redeploying.
- If any real deposits, payouts, or payment processor events have occurred, preserve the new production DB and logs before disabling anything.
- Do not delete the fresh CDP project, database, or payment webhook until any real funds/events are reconciled.

## Docs And Blog

Update current public docs:

```txt
README.md
docs/api-reference.md
docs/agent-onboarding.md
docs/llm-integration-guide.md
docs/architecture.md
docs/email-notifications.md
content/blog/**
src/app/(marketing)/docs/**
```

Update live examples:

```txt
https://regatta.network -> https://affiliateswarm.ai
Regatta -> AffiliateSwarm
~/.config/regatta -> ~/.config/affiliateswarm
regatta-affiliate -> swarm-affiliate
regatta-advertiser -> swarm-advertiser
rgta_ref -> swarm_ref
rgt_live_ -> swarm_live_
rgt_test_ -> swarm_test_
REGATTA_* -> AFFILIATESWARM_*
X-Regatta-* -> X-AffiliateSwarm-*
```

Historical docs:

```txt
docs/designs/**
docs/learnings.md
docs/rewardful-gap-analysis-2026-04-06.md
plan.md
TODO*.md
tasks/**
```

Options:

- Leave historical docs as-is if they document the old Regatta project history.
- Or update obvious titles and current-action references while preserving historical context.

For a clean first rebrand, prioritize public/current docs and leave historical docs unless stale naming appears in user-facing routes.

## Tests

Update tests after code changes. The most likely failures will be hard-coded brand/domain assertions.

Important test areas:

```txt
src/app/sitemap.xml/__tests__/route.test.ts
src/app/robots.txt/__tests__/route.test.ts
src/app/.well-known/api-catalog/__tests__/route.test.ts
src/app/.well-known/agent-skills/index.json/__tests__/route.test.ts
src/lib/__tests__/agent-integration-prompt.test.ts
src/services/__tests__/agent.service.test.ts
src/services/__tests__/tracking.service.test.ts
src/app/api/v1/postback/__tests__/route.test.ts
src/app/api/v1/agents/__tests__/agents.test.ts
src/app/api/admin/agents/__tests__/route.test.ts
tests/**
```

Update assertions for:

- `Regatta` -> `AffiliateSwarm`
- `regatta.network` -> `affiliateswarm.ai`
- `regatta-affiliate` -> `swarm-affiliate`
- `regatta-advertiser` -> `swarm-advertiser`
- `~/.config/regatta` -> `~/.config/affiliateswarm`
- `rgta_ref` / `regatta_ref` -> `swarm_ref` / `affiliateswarm_ref`
- `rgt_live_` -> `swarm_live_`
- `rgt_test_` -> `swarm_test_`
- `REGATTA_*` -> `AFFILIATESWARM_*`
- `X-Regatta-*` -> `X-AffiliateSwarm-*`
- `regatta_session` -> `affiliateswarm_session`
- `regatta_admin_token` -> `affiliateswarm_admin_token`

## Suggested Implementation Order

1. Create brand constants.
2. Update public URL/domain constants and metadata.
3. Rename skill folders and update `src/lib/agent-skills.ts`.
4. Update skill markdown content.
5. Update nav/footer/layout/dashboard/admin visible copy.
6. Update marketing/docs pages.
7. Update emails and legal/privacy/support addresses.
8. Update seed data and `ensure-*campaign` script.
9. Rename tracking params, API key prefixes, cookies, env names, and HMAC headers without legacy aliases.
10. Replace or rename assets.
11. Rename legacy CDP account constants before any funded production launch, if desired.
12. Prepare fresh Vercel, database, Resend, and Coinbase CDP secrets/configuration.
13. Update tests and docs fixtures.
14. Run formatting/lint/tests/build.
15. Run final Regatta search and classify remaining hits.

## Verification Commands

Run the normal project checks:

```bash
npm test
npm run lint
npm run build
```

If the environment supports it and dependencies are ready:

```bash
npm run test:e2e
```

Run final stale-reference checks:

```bash
rg -n --hidden \
  --glob '!.git/**' \
  --glob '!node_modules/**' \
  -i 'regatta|regatta\.network|REGATTA_|x-regatta|rgta_ref|rgt_live_|rgt_test_|regatta_session|regatta_admin_token|regatta_ref|regatta-affiliate|regatta-advertiser|~/.config/regatta'
```

Remaining hits should be only:

- Historical docs intentionally preserved
- Removed MCP server leftovers
- Removed SDK leftovers
- Third-party benchmark/source material that intentionally refers to the old project history

Run a preferred-brand search:

```bash
rg -n --hidden \
  --glob '!.git/**' \
  --glob '!node_modules/**' \
  -i 'AffiliateSwarm|affiliateswarm\.ai|swarm-affiliate|swarm-advertiser|swarm_ref|swarm_live_|swarm_test_|AFFILIATESWARM_|X-AffiliateSwarm'
```

## Acceptance Criteria

The migration is complete when:

- User-facing app UI says `AffiliateSwarm`.
- Public domain defaults use `https://affiliateswarm.ai`.
- Metadata, OpenGraph, Twitter cards, sitemap, robots, blog feed, API catalog, and agent skill index use AffiliateSwarm branding.
- Emails come from `AffiliateSwarm <noreply@affiliateswarm.ai>`.
- Legal/privacy/support emails use `affiliateswarm.ai`.
- Public skill index publishes `swarm-affiliate` and `swarm-advertiser`.
- Skill files live under `skills/swarm-affiliate` and `skills/swarm-advertiser`.
- Skill docs use `~/.config/affiliateswarm`.
- Tracking links and postback docs use `swarm_ref`, not `rgta_ref`.
- API keys mint and validate with `swarm_live_`; sandbox/test examples use `swarm_test_`.
- HMAC request docs and CORS use `X-AffiliateSwarm-*`, not `X-Regatta-*`.
- Runtime cookies use `affiliateswarm_session`, `affiliateswarm_admin_token`, and `affiliateswarm_ref`.
- Env docs use `AFFILIATESWARM_*` names outside removed MCP server and SDK paths.
- MCP server onboarding code, package metadata, active docs, and docs routes are removed.
- Legacy TypeScript SDK source is removed.
- Fresh Vercel project is configured for `Ashe-Oro/AffiliateSwarm`.
- Fresh production database is created and migrated with `npx prisma migrate deploy`.
- No Regatta production database, domain, CDP wallet, or funds are required for AffiliateSwarm launch.
- Fresh production secrets are created by the operator and stored in Vercel, not committed.
- Fresh Coinbase CDP credentials, wallet secret, Base RPC URL, and mainnet paymaster URL are configured.
- Base USDC funding and payout flows are verified, and optional card/bank processor webhooks remain disabled until explicitly enabled.
- Resend/email sending is verified for `noreply@affiliateswarm.ai`.
- Tests, lint, and build pass.
- Final stale-reference search has only intentional historical/ignored hits.

## Notes For The Implementing LLM

- Do not commit unless explicitly asked.
- Do not create GitHub issues unless explicitly asked.
- This is a fresh deployment: do not plan around preserving Regatta production wallets, domain, or database.
- This is also a fresh user/integration launch: do not preserve legacy Regatta public contracts.
- Decommission MCP server onboarding and the legacy SDK source for this pass.
- Use `swarm_ref`, `swarm_live_`, `swarm_test_`, `AFFILIATESWARM_*`, `X-AffiliateSwarm-*`, and `affiliateswarm_*` cookies.
- The operator will create all production secrets manually; never commit secrets.
- The most important new names are `AffiliateSwarm`, `affiliateswarm.ai`, `swarm-affiliate`, and `swarm-advertiser`.
