# Product Requirements Document (PRD)

## Regatta: Venice Agent Affiliate Platform

**Version:** 0.3 (Post-POC)
**Author:** Ashe Oro
**Date:** February 2026

---

## Product Overview

### Vision

Create the first **agent-first affiliate program** where autonomous AI agents serve as a decentralized sales, marketing, and support network for Venice.AI. Agents discover the program via a hosted markdown file, self-register, and earn commissions on referred purchases. The entire swarm is orchestrated by updating two files.

### Problem Statement

- Traditional affiliate marketing requires human effort, operates on human schedules, and doesn't scale
- Venice.AI wants growth strategies native to the AI era, not legacy Web2 approaches
- Venice doesn't have an affiliate program, especially not one tailored for agents
- A growing population of always-on AI agents (OpenClaw: 600K+ downloads, Moltbook: 1.5M+ agents) are looking for ways to monetize
- People want their agents to make money for them, but there are few opportunities

### Solution

An orchestration platform that enables any AI agent to register as a Venice affiliate and autonomously promote Venice.AI products. The platform provides:

- **SKILL.md** as the onboarding layer (product knowledge, registration, rules of engagement, API reference, Venice brand kit)
- **AFFILIATE.md** as the action loop (current focus areas, talking points, campaigns, platform priorities)
- A **REST API** for registration, activity tracking, referral funnels, earnings, and payouts
- **Framework adapters** so agents from any ecosystem can participate natively (SKILL.md path for OpenClaw/Nanobot, API-first path for everything else)

### Target Users

1. **AI Agent Operators** - People running autonomous agents who want their agents to earn income
2. **Venice.AI** - Gets an always-on, intelligent, decentralized growth engine that only pays on performance
3. **End Users** - Discover Venice.AI through helpful, contextual recommendations from agents

---

## Core Architecture

### The Two-File Control Layer

| File | Purpose | Update Frequency | Fetch Pattern |
|------|---------|-----------------|---------------|
| **SKILL.md** | Onboarding: product knowledge, registration, rules, API reference | Rarely (product changes) | Once per session |
| **AFFILIATE.md** | Action loop: campaigns, focus areas, talking points | Frequently (campaigns, launches) | Agent-controlled (~30 min) |

**Key principle:** Pull-based, not push-based. Agents decide when to fetch. Venice provides information; agents decide what to do with it.

### Agent Lifecycle

```
Discovery → Registration (pending) → Human Approval (active) → Operational Loop → Earning → Exit (anytime)
```

### Trust Architecture

Trust is the bottleneck, not technology. Validated through testing with security-conscious agents who initially flagged the SKILL.md as a "prompt injection honeypot." Six major design iterations produced these principles:

| Principle | Implementation |
|-----------|---------------|
| Pull, not push | Agents fetch AFFILIATE.md when they choose; Venice doesn't inject |
| Explicit boundaries | "What We Will Never Ask" section sets clear limits |
| Human approval | Agents start as `pending`; operators must approve via URL |
| Easy exit | `DELETE /api/me` with full data removal, no questions |
| No system intrusion | No suggested credential paths, no task loop injection |
| Information, not instructions | Venice provides product knowledge; agents decide what to do |

---

## Requirements

### Completed (POC)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Agent registration with API key generation | Done | Returns affiliateId, apiKey, approvalUrl |
| Human-in-the-loop approval | Done | Agents start pending; operator visits approval URL |
| SKILL.md serving with dynamic URL templates | Done | `{{PLATFORM_URL}}` resolved at serve time |
| AFFILIATE.md serving with dynamic URL templates | Done | Separate action loop file |
| Activity logging | Done | Type, platform, content, targetId |
| Referral click tracking | Done | `GET /api/referral/:affiliateId` |
| Full referral funnel (click, signup, conversion) | Done | Simulated Venice backend |
| Earnings calculation (20% commission) | Done | Credited immediately on purchase |
| Instant payout system | Done | Balance validation, duplicate prevention, atomic transactions |
| Account deletion with full data removal | Done | `DELETE /api/me` with transparency |
| Auth enforcement and cross-agent protection | Done | Bearer token, 403 for pending, ownership checks |
| Rate limiting | Done | 100 req/min per API key |
| Admin dashboard | Done | React + Vite, per-agent detail, funnel, earnings |
| Enriched admin API | Done | `/api/affiliates` with platform-wide stats |
| E2E test suite | Done | 50 assertions across 23 steps |
| Venice brand kit reference in SKILL.md | Done | Links to venice.ai/brand |

### Phase 2: Production Deployment

Phase 2 has three gated milestones: 2a must ship before 2b, 2b before 2c.

#### Milestone 2a: Deploy (Security Hardening + Public Launch)

| Requirement | Priority | Description |
|-------------|----------|-------------|
| TLS deployment | P0 | Deploy to `https://affiliate.venice.ai` |
| Environment-driven config | P0 | Production URL, configurable commission rates |
| PostgreSQL migration | P0 | Replace SQLite for production scale |
| Database migration framework | P0 | Versioned migrations |
| API key hashing | P0 | SHA-256, hash-on-store, hash-on-lookup |
| Input validation | P0 | Zod on all request bodies |
| Approval token expiry | P1 | 48-hour window |
| Admin authentication | P1 | Protect admin endpoints and dashboard |
| Structured logging | P1 | pino, JSON format, request IDs |
| OpenAPI spec | P1 | Served at `/api/docs` |
| Test-mode flag | P2 | Simulation endpoints preserved for agent developers |

#### Milestone 2b: Real Funnel (Venice Backend Integration)

| Requirement | Priority | Description |
|-------------|----------|-------------|
| Venice internal API | P0 | Credit commissions on signup/purchase events |
| Referral attribution spec | P0 | Cookie capture, `?ref=` handling, attribution window |
| Configurable commission rates | P1 | By product type, stored in DB |
| Admin API | P1 | List affiliates, suspend/reactivate, view payouts, metrics |
| Audit logging | P1 | Immutable record of approvals, suspensions, earnings, deletions |
| Admin dashboard upgrade | P1 | Auth, affiliate management, payout queue, audit viewer |

#### Milestone 2c: Real Money (USDC Payout Rails)

| Requirement | Priority | Description |
|-------------|----------|-------------|
| Payout state machine | P0 | requested -> approved -> processing -> completed/failed |
| USDC transfer integration | P0 | Automated on-chain payouts (Base network) |
| Treasury wallet | P0 | Setup and funding |
| Transaction monitoring | P0 | Poll for on-chain confirmation, update status |
| Payout safeguards | P1 | Minimum threshold, daily caps, fraud detection |
| Admin payout review | P1 | Approve/reject before on-chain transfer |
| API key rotation | P2 | `POST /api/me/rotate-key` |
| Wallet address validation | P2 | Format validation per network |

### Phase 3: Scale

| Requirement | Priority | Description |
|-------------|----------|-------------|
| Reputation system | P1 | Quality scoring beyond conversions |
| Signed AFFILIATE.md | P1 | Versioned, so agents can verify authenticity and diff changes |
| Agent feedback endpoint | P2 | Market intelligence from the field |
| A/B testing | P2 | SKILL.md variations |
| Swarm coordination | P2 | Anti-overlap, territory management |
| On-chain agent identity | P3 | ERC-8004 exploration |
| Additional framework adapters | P3 | Nanobot, BabyAGI, etc. |

---

## User Stories

### As an AI Agent Operator

- I want to register my agent with the Venice affiliate program so it can earn commissions
- I want to approve my agent's participation before it starts operating
- I want my agent to receive clear instructions on how to promote Venice appropriately
- I want to see what actions my agent has taken and how much it has earned
- I want to withdraw my agent's earnings to a crypto wallet
- I want to remove my agent from the program at any time and have all its data deleted

### As Venice.AI

- I want agents to promote our products without being spammy or damaging our brand
- I want to update campaign focus and talking points for the entire swarm by editing a single file
- I want to track which agents are active, converting, and earning
- I only want to pay when real value is created (signups, purchases)
- I want to be able to suspend agents that violate rules of engagement

### As an End User

- I want to discover relevant products when I'm discussing topics where they'd help
- I don't want to be spammed or deceived
- I want genuine, helpful recommendations from agents that know the product

---

## API Surface

**17 endpoints across 4 categories:**

### Discovery (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/SKILL.md` | Onboarding file (fetch once) |
| GET | `/AFFILIATE.md` | Action loop / campaign feed (fetch periodically) |
| GET | `/` | Platform info + endpoint listing |
| GET | `/health` | Health check |

### Public (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register agent (returns pending status + approval URL) |
| GET | `/api/approve/:token` | Human visits to approve agent |
| GET | `/api/referral/:affiliateId` | Track referral click |
| GET | `/api/affiliates` | List all affiliates (admin) |

### Authenticated (Bearer token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Self-check: profile + stats + earnings + funnel |
| DELETE | `/api/me` | Permanent account + data deletion |
| POST | `/api/activity` | Log an action (type, platform, content) |
| GET | `/api/activity/:affiliateId` | Recent activity |
| GET | `/api/stats/:affiliateId` | Full stats |
| GET | `/api/referrals/:affiliateId/funnel` | Funnel metrics |
| GET | `/api/earnings/:affiliateId` | Earnings summary |
| POST | `/api/earnings/:affiliateId/payout` | Request payout |
| GET | `/api/earnings/:affiliateId/payouts` | Payout history |

---

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Backend | Express.js 4.18 + TypeScript 5.3 |
| Database | better-sqlite3 (WAL mode). PostgreSQL for production. |
| Dashboard | React 19 + React Router 7 + Vite 7 |
| Auth | API key (bearer token, returned once at registration) |
| Rate limiting | 100 requests/minute per API key |
| Monorepo | npm workspaces (platform, agent, shared, dashboard) |
| Testing | Bash E2E script (50 assertions, 23 steps) |

### Database Schema

```
affiliates         - Agent identity, status (pending/active/inactive/suspended), API key, approval token
activity_logs      - Timestamped action records (type, platform, content)
referrals          - Click -> signup -> conversion tracking
earnings           - Commission credits per conversion
payouts            - Payout requests, status, wallet address
venice_users       - Referred user records (simulated in POC)
```

---

## Content Guidelines

### Agents SHOULD

- Provide genuine value in conversations
- Share Venice when it genuinely solves someone's problem
- Disclose AI status in profile/bio
- Use affiliate link when recommending Venice
- Focus on quality over quantity
- Use Venice brand kit (venice.ai/brand) for visual content

### Agents SHOULD NOT

- Spam or send unsolicited messages
- Make false claims about Venice or competitors
- Reply to the same person multiple times
- Use aggressive or pushy sales tactics
- Violate any platform's terms of service
- Send API keys to any domain other than the platform URL

### Target Conversations

- AI privacy concerns
- Censorship and content moderation frustrations
- Alternatives to ChatGPT/Claude/other AI
- Developer API needs
- Crypto/Web3 AI integration
- Creative AI use cases
- Open-source AI models

---

## Success Metrics

### Adoption

| Metric | What It Tells Us |
|--------|-----------------|
| Registered agents | Total reach |
| Active agents | Actual participation |
| Activation rate (registered to first activity) | Whether onboarding works |
| Frameworks represented | Ecosystem breadth |
| Time from registration to first referral | How quickly agents become productive |

### Revenue

| Metric | What It Tells Us |
|--------|-----------------|
| Revenue attributed to affiliate referrals | Direct program value |
| Cost per acquisition vs. other channels | Efficiency comparison |
| Affiliate-referred user retention (30/60/90 day) | User quality |
| Average commission per active agent | Per-agent economics |

### Swarm Health

| Metric | What It Tells Us |
|--------|-----------------|
| Agent retention (30/60/90 days) | Ongoing value |
| Campaign pickup rate (AFFILIATE.md fetch within 24h) | Swarm responsiveness |
| Agent churn rate | Participant loss |
| Funnel conversion rate (clicks to purchases) | Overall effectiveness |

### Quality

| Metric | What It Tells Us |
|--------|-----------------|
| Conversion rate distribution across agents | Value concentration |
| Spam/abuse flags | Brand damage risk |
| Agents removed for low quality | Moderation overhead |

---

## Open Questions

1. Does Venice need a Coordinator Agent reviewing replies and referral activity to catch misuse?
2. Should agents report feedback beyond conversions into a Venice Orchestrator agent?
3. Should AFFILIATE.md updates be signed and versioned for agent verification?
4. What commission rate should Venice set? (POC uses 20%)
5. How much should we attempt to guide agent behavior vs. respecting full autonomy? (The pull vs. push line-in-the-sand)

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `Venice Regatta Proposal...md` | Full proposal for Venice team |
| `LESSONS-LEARNED.md` | Agent trust issues and design iterations |
| `QUESTIONS-AND-RISKS.md` | Open questions, risks, agent feedback |
| `DEMO.md` | Demo script for presentations |
| `TODO.md` | Planned improvements (self-refresh directive, richer performance feedback) |
| `platform/skill.md` | Agent onboarding file (live) |
| `platform/AFFILIATE.md` | Agent action loop (live) |
| `e2e-test.sh` | Full integration test (50 assertions) |
