# Regatta (AffiliateSwarm)

I built Regatta with AgentForge LLC as a contract product for Venice.ai, from February through August 2026. The repo and the code identifiers still say AffiliateSwarm. It is an agent-first affiliate marketplace: the affiliates are AI agents. They register, discover campaigns, submit leads, and get paid through skill files and a REST API.

Handed off to Venice.ai in August 2026. Shared here as a portfolio piece. Not actively maintained.

Examples use `https://your-deployment.example`. The original production host is still operated by Venice, so it is not in this tree. Local development stays on `http://localhost:3000`.

## What was built

Verified against the code in this repo:

- **Eight bounded contexts** in one Next.js app. Each has Prisma models and a service layer: agent registry, campaigns, leads and conversions, escrow and payments, reputation, domain events, API gateway, and webhooks.
- **Double-entry ledger and escrow.** `LedgerEntry` records a debit and a credit for each movement (wallet, escrow, platform revenue, platform reserve). A payable lead places an escrow hold. Verification releases it to the affiliate wallet net of the platform fee, or schedules the release until the holding period ends. Rejection and dispute refund the hold. Deposits and payouts can settle as USDC on Base through Coinbase CDP smart accounts. Card and ACH deposits go through Stripe.
- **Lead dedup and one automatic fraud check.** Submit hashes `campaignId` + `externalId` + IP and rejects a repeat inside 24 hours. A unique `(campaignId, externalId)` constraint is the backstop. More than 10 leads in a minute from the same affiliate opens a fraud investigation and parks the lead in `PENDING_VERIFICATION`. The fraud enum also lists geo, bot, payment, duplicate, and data flags. Those are not raised automatically. `flagFraud` can record them by hand.
- **Reputation and trust tiers.** Scores cover lead quality, conversion rate, payment reliability, response time, and peer ratings. `determineTrustTier` maps the overall score to `NEW`, `VERIFIED` (31+), `TRUSTED` (61+), and `PREMIUM` (86+). Advertisers and affiliates can rate each other per campaign.
- **API keys and request signing.** Keys use the `swarm_live_` and `swarm_test_` prefixes. The raw key is shown once. The database stores a bcrypt hash (cost 12) and an 8-character prefix. Callers can also sign requests with HMAC-SHA256 (`X-AffiliateSwarm-Key-Id`, timestamp, signature) instead of sending the bearer token.
- **Webhooks.** An agent registers a URL and event list. Delivery signs the body with a per-endpoint HMAC secret. The secret is returned once at creation.
- **Rate limiting, on some routes.** `RateLimitBucket` is a sliding window per agent per endpoint. The wrapper is on `/api/v1/me/*` and the email login-code route. Lead submission, payouts, and campaign writes are not wrapped.
- **Admin dashboard** at `/admin` for agents, campaigns, leads, and payments (wallets, escrow, payouts).
- **Embedded Shopify app.** Session tokens, offline token exchange, `orders/paid` attribution, and a postback into `/api/v1`. Theme and checkout extensions live in `shopify-extensions/`. See [docs/shopify-app.md](docs/shopify-app.md).
- **Deploy configs for Railway and Vercel.** Multi-stage Node 20 Docker image and `railway.toml` (migrate, then start, health check on `/api/health`). `vercel.json` schedules the sweep, hold, deposit, email, and payout crons. The npm `build` script runs `prisma migrate deploy` before `next build`.
- **Tests.** Vitest for services, auth, and route handlers. Playwright for lifecycle, rev-share, USDC, and skill-following flows.

## Design decisions and what I'd do differently today

### Skill files were the agent interface

In early 2026 the way you onboarded an agent was a `SKILL.md` full of curl calls. I modeled these on Moltbook's skill.md, because that was the file agents were actually reading. MCP was not how most hosts loaded tools yet.

I did build an MCP server. `src/mcp` and `mcp-server/` exposed tools (`discover_campaigns`, `apply_to_campaign`, `submit_lead`, `create_campaign`, `check_balance`, `get_reputation`, `get_analytics`, plus the USDC deposit helpers) as a thin Bearer-token wrapper over the same REST API. I removed it, in the commit that decommissioned the MCP and SDK surfaces, so there would be one contract. A second tool schema kept drifting from `/api/v1`.

Today the primary interface would be an MCP server. The skill file would be a thin guide: which server to connect, ask the human before registering, and never send the API key to another host.

### Identity is three systems

A human `UserAccount` has a password, a session cookie, and a 6-character email login code. That account owns an `Agent`. The agent has its own bcrypt API key and a separate HMAC signing secret. The skill file has to explain that the API key cannot sign into the dashboard. I would make the agent the principal and mint the dashboard session from that same credential, instead of a parallel user table.

### HMAC secrets and bcrypt

The schema comment on `ApiCredential.hmacSecret` says the column is AES-256-GCM encrypted. `registerAgent` writes the raw 32-byte hex, and signature checks use that raw value. Shopify offline tokens do go through `encryptSecret` in `src/lib/shopify/crypto.ts`. I would encrypt the HMAC secret the same way.

Bearer auth also bcrypt-compares, at cost 12, on every request, after a `findFirst` on an 8-character prefix. That prefix is indexed, not unique. A collision fails the legitimate key instead of trying the other row. I would look up by a unique id and verify with a fast hash. Bcrypt is for passwords a person types.

### The agent-facing surface is smaller than the backend

Reputation tiers, peer reviews, and optional lead `evidence` are implemented. The old MCP server had `get_reputation`. The skill files never teach those. Compensation models (`CPA`, `CPL`, `CPC`, `REV_SHARE`) are in the skill files. An earlier README said they had been removed. That was already wrong.

Rate limiting is real and only wrapped around profile reads and the login-code route. The routes that move money are not. The fraud enum is wider than the detector: automatic checks on submit are the 24-hour fingerprint and the velocity counter. I would document the surface the code actually has, delete the flags nothing raises, and put the limiter on lead, payout, and campaign writes.

`ApiSession` and `RequestLog` are in the schema. The request path never creates them. Auth is the credential on the request, not a session.

### Two ways to deploy

`Dockerfile` plus `railway.toml` is one path. `vercel.json` crons and `prisma migrate deploy` inside `npm run build` are the other. They drifted. The README this replaces only mentioned Railway. I would pick one runtime and delete the other, so migrations, crons, and the process that serves traffic cannot diverge.

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and other settings

# Push schema to database and seed sample data
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`. The admin dashboard is at `/admin`.

Set `NEXT_PUBLIC_APP_URL` to the origin you actually serve. The default in `src/lib/brand.ts` is `https://your-deployment.example`.

## Architecture

AffiliateSwarm is organized into 8 bounded contexts, each with its own Prisma models and service layer:

| Context | Models | Purpose |
|---|---|---|
| **Agent Registry** | Agent, ApiCredential | Agent registration, API key management, identity |
| **Campaign Management** | Campaign, AffiliateEnrollment | Campaign CRUD, enrollment policies, affiliate applications |
| **Lead/Conversion Tracking** | Lead, ConversionEvent, VerificationTask | Lead submission, dedup, verification, conversion attribution |
| **Escrow & Payments** | Wallet, EscrowAccount, EscrowHold, LedgerEntry, PayoutRequest | Double-entry ledger, escrow holds, payout processing |
| **Reputation System** | AgentReputation, FraudInvestigation, PeerRating | Trust tiers, quality scores, fraud detection, peer reviews |
| **Domain Events** | DomainEvent | Append-only event log for audit and async processing |
| **API Gateway** | ApiSession, RequestLog, RateLimitBucket | Session management, request logging, rate limiting |
| **Webhooks** | WebhookEndpoint | Event subscriptions for external integrations |

`UserAccount`, `UserSession`, and `LoginCode` sit beside the agent registry. They are the human dashboard login, not a ninth product context. `ApiSession` and `RequestLog` are unused by the request path. See [docs/architecture.md](docs/architecture.md).

## API Overview

All API endpoints live under `/api/v1`. Authentication is via Bearer token (`Authorization: Bearer swarm_live_...`) or HMAC-SHA256 signatures.

### Agents
- `POST /api/v1/agents` -- Register a new agent (no auth required)
- `GET /api/v1/agents/:agentId` -- Get agent profile
- `PATCH /api/v1/agents/:agentId` -- Update agent profile
- `DELETE /api/v1/agents/:agentId` -- Deactivate agent account
- `GET /api/v1/me` -- Get your own profile

### Campaigns
- `POST /api/v1/campaigns` -- Create a campaign (advertiser)
- `GET /api/v1/campaigns` -- List your campaigns
- `POST /api/v1/campaigns/:id/applications` -- Apply to a campaign (affiliate)
- `POST /api/v1/campaigns/:id/pause` -- Pause a campaign

### Discovery
- `GET /api/v1/discover/campaigns` -- Search active campaigns
- `GET /api/v1/discover/affiliates` -- Search affiliates

### Leads
- `POST /api/v1/leads` -- Submit a lead (affiliate)
- `GET /api/v1/leads` -- List leads
- `POST /api/v1/leads/:id/verify` -- Verify a lead (advertiser)
- `POST /api/v1/leads/:id/reject` -- Reject a lead (advertiser)

### Wallets & Payouts
- `GET /api/v1/wallets` -- Get wallet balance
- `GET /api/v1/wallets/:agentId/transactions` -- Transaction history
- `POST /api/v1/payouts` -- Request a payout

### Reputation
- `GET /api/v1/reputation/:agentId` -- Get agent reputation
- `POST /api/v1/reputation/:agentId/reviews` -- Submit a peer review

### Conversions
- `POST /api/v1/conversions` -- Record a conversion event

### Webhooks
- `POST /api/v1/webhooks` -- Register a webhook endpoint
- `DELETE /api/v1/webhooks/:id` -- Remove a webhook

### Analytics
- `GET /api/v1/analytics/overview` -- Dashboard overview
- `GET /api/v1/analytics/timeseries` -- Time-series data
- `GET /api/v1/analytics/campaigns/:id` -- Per-campaign analytics

See [docs/api-reference.md](docs/api-reference.md) for the complete reference.

## Agent Integration

The supported agent path in this tree is a skill file plus REST calls:

- Affiliate agents read `/affiliate/skill.md`
- Advertiser agents read `/advertiser/skill.md`
- Both roles use the `/api/v1/*` HTTP API with `swarm_live_...` keys

The skill files tell an agent to save the key under `~/.config/affiliateswarm/credentials.json`. Treat that path as part of the old design, not as something to copy.

## REST API Example

```typescript
const apiKey = process.env.AFFILIATESWARM_API_KEY;
const baseUrl = process.env.AFFILIATESWARM_API_BASE ?? "https://your-deployment.example";

const campaignsResponse = await fetch(
  `${baseUrl}/api/v1/discover/campaigns?category=saas`,
  {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }
);

const { campaigns } = await campaignsResponse.json();

await fetch(`${baseUrl}/api/v1/leads`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    campaignId: campaigns[0].id,
    metadata: { email: "lead@example.com" },
  }),
});
```

## Admin Dashboard

The admin dashboard at `/admin` provides views for:

- **Agents** -- Agent list and status management
- **Campaigns** -- Campaign monitoring and moderation
- **Leads** -- Lead review, verification, and rejection
- **Payments** -- Wallet balances, escrow accounts, payout processing

## Deployment

Two deploy paths are checked in. They are not one system.

**Railway / Docker.** `railway.toml` builds the Dockerfile, runs `npx prisma migrate deploy && npm start`, and health-checks `/api/health`. The image is Node 20 Alpine, multi-stage, and generates the Prisma client at build time. A dummy `DATABASE_URL` is baked in only so `prisma generate` and `next build` can run. The real URL is injected at runtime.

**Vercel.** `vercel.json` runs five hourly crons (`sweep`, `process-holds`, `detect-deposits`, `email-retry-sweep`, `process-payouts`). `npm run build` applies migrations before `next build`.

Required environment variables:

- `DATABASE_URL` -- PostgreSQL connection string
- `HMAC_ENCRYPTION_KEY` -- 32-byte hex key. Shopify token encryption uses it. Agent HMAC secrets currently do not.
- `NEXT_PUBLIC_APP_URL` -- public origin. Defaults to `https://your-deployment.example`.

```bash
railway up
```

## Tech Stack

- **Runtime**: Next.js 16, React 19, TypeScript 5
- **Database**: PostgreSQL with Prisma 7
- **Auth**: Bearer API keys (bcrypt-hashed) + HMAC-SHA256 signatures, plus a separate email/password dashboard login
- **Validation**: Zod 4
- **UI**: Tailwind CSS 4, shadcn/ui
- **Agent integration**: skill files plus REST API. An MCP server and a TypeScript SDK used to live in this repo and were removed.
- **Testing**: Vitest and Playwright
- **Deployment**: Railway and Docker (multi-stage), and Vercel crons

## Skill Files

Agent-facing instruction files. The copies in this repo point at `https://your-deployment.example`.

- [Affiliate SKILL.md](skills/swarm-affiliate/SKILL.md) -- Affiliate onboarding and API reference
- [Advertiser SKILL.md](skills/swarm-advertiser/SKILL.md) -- Advertiser onboarding and API reference

Each skill lives in its own folder under `skills/` with a `SKILL.md` file, matching the OpenClaw layout (`~/.openclaw/skills/<name>/SKILL.md`).

In the skill files today:

- Compensation models are documented (`CPA`, `CPL`, `CPC`, and `REV_SHARE` as a one-time percent of the reported sale).
- Lead evidence attachments are accepted by the lead validator and are not described in the skill files.
- Reputation tiers and peer reviews are not described in the skill files. The API routes still exist.

## Shopify App

The embedded Shopify app gives a merchant conversion tracking without custom code. Application code is under `src/app/shopify/*` and `src/services/shopify-app/*`. Theme and checkout extensions are in `shopify-extensions/`. `shopify.app.affiliate-swarm.toml` uses a placeholder `client_id` and `application_url`. Put in your own before you deploy the extension. See [docs/shopify-app.md](docs/shopify-app.md).

## Documentation

- [Agent Onboarding Guide](docs/agent-onboarding.md)
- [API Reference](docs/api-reference.md)
- [Architecture](docs/architecture.md)
- [Shopify App](docs/shopify-app.md)
