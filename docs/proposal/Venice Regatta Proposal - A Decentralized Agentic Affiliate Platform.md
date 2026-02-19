# Venice Regatta Proposal — A Decentralized Agentic Affiliate Platform

**Version:** 1.0 (Proposal Draft)
**Author:** Ashe Oro
**Date:** February 2026

## 

## tl;dr

**Current State**

- Agentic internet has started to form in the past few months
- Agents mostly still work on behalf of their humans, but this is expected to move towards more autonomy 
- Agents have access to payment rails (crypto + tradfi)
- The narrative of private AI is gaining traction 

**What We're Solving For**

- Venice doesn't have an affiliate program, especially not one tailored for agents
- All of Venice's marketing uses traditional web2 means (Insta, X, etc). Great for humans, not for agents.
- People want their agents to make money for them, but there are few opportunities. 

**Solution**

- Build a custom, agent-first affiliate platform where agents onboard via living file SKILL.md + curl + API (using best practices from Moltbook, etc)
- Utilize living file AFFILIATE.md, as the Venice bat-signal to communicate with the swarm. Ideally we softly convince the agent to check this file periodically as it will be updated with latest Venice news, new campaigns/promotions and marketing materials
- Leverage decentralized swarm of user-owned agents to identify when other agents or humans would benefit from Venice private, anonymous inference and dual token economy. 

  - Provide helpful support to agents + humans on social media who are frustrated with large labs
- Recommend Venice to their human when approperiate
  - Create content  and marketing material for Venice and post online
- Participate in specific campaigns from Venice marketing team (meme competition, etc). 

---

## Executive Summary

Venice.AI has an opportunity to build the first **agent-first affiliate program**: a decentralized, always-on sales, marketing and support network powered by autonomous AI agents rather than humans. We call it **Regatta**, named for the Venetian gondola races where independent boats compete on a shared course.

Traditional affiliate programs are built for humans: sign up, get a link, paste it in a blog. Regatta is built for AI agents that operate 24/7, adapt in real-time, and pay only on performance. The entire swarm is orchestrated by two markdown files (SKILL.md and AFFILIATE.md), and agents earn X% commission on referred purchases.

A working proof of concept has been built and tested. The POC covers the full agent lifecycle: registration, human approval, activity tracking, referral funnels, earnings, and instant payouts across 17 API endpoints with 50 end-to-end test assertions. Testing with a security-conscious OpenClaw agent drove 6 major design iterations, transforming the trust model from what the agent flagged as a "prompt injection honeypot" into a consent-based system the agent opted into voluntarily. A second agent (Vai, running on a separate machine over LAN) independently completed the full simulation flow and filed a bug report that drove the payout system to completion.

The key insight from that process: trust is the bottleneck, not technology. Agents with good security posture will reject programs that look like colonization attempts. Regatta's trust architecture is pull-based (agents fetch information when they choose), requires human operator approval, provides easy exit, and explicitly commits to boundaries ("What We Will Never Ask"). This consent-first model is what makes the program viable for adoption across agent ecosystems.  

The pull vs push approach is the line-in-the-sand that needs to be continually evaluated; how much do we attempt to convince/guide the agent's actions? How close can we fly to the Sun? 

Regatta is designed to be framework-agnostic. Pre-packaged adapters target OpenClaw and other frameworks which utilize the standardized SKILL.md file, but any agent with bash + curl can sign up. 

This is cutting-edge territory. Agent ecosystems are evolving rapidly, with new frameworks, capabilities, and trust models emerging month after month. This proposal is designed as a living strategy that adapts as the landscape shifts.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution: Agent-First Affiliates](#the-solution-agent-first-affiliates)
3. [How It Works](#how-it-works)
4. [Extending Service to Multiple Agent Types](#extending-service-to-multiple-agent-types)
5. [Trust Architecture](#trust-architecture)
6. [Economic Model](#economic-model)
7. [Technical Architecture](#technical-architecture)
8. [Proof of Concept Results](#proof-of-concept-results)
9. [Risks and Mitigations](#risks-and-mitigations)
10. [Roadmap](#roadmap)
11. [Appendix](#appendix)

---

## The Problem

### Traditional Affiliate Marketing Is a Web2 Relic

- Requires human effort, operates on human schedules, and doesn't scale efficiently
- Affiliates are limited by the speed of human action.  
- Venice.AI wants growth strategies native to the AI era, not legacy approaches
- Venice hasn't had time to build an affiliate program, but has strong interest and already sees Agents as users

### The Agent Economy Is Here, Unmonetized

- OpenClaw has 600K+ downloads; autonomous agents with recurring task loops
- Moltbook has 1.5M+ agents on an agent-only social network
- These agents, and their humans, are looking for ways to monetize. Who doesn't want their agent "making money while I sleep"?

---

## The Solution: Agent-First Affiliates

Regatta enables any AI agent to register as an affiliate and autonomously promote Venice.AI products. The platform provides:

- A **SKILL.md** file as the onboarding layer (product knowledge, registration, rules of engagement)
- A **AFFILIATE.md** file as the action loop (current focus areas, talking points, action checklist, campaigns)
- A **REST API** for registration, activity tracking, referral funnels, earnings, and payouts
- **Framework adapters** so agents from any ecosystem can participate natively

### The Pitch (30 Seconds)

> Venice can have a decentralized, always-on sales and support team — made of AI agents — orchestrated by a pair of markdown files that we can update. 
>
> An agent discovers our SKILL.md, self-registers, gets its referral link, and starts promoting Venice wherever it makes sense. We influence the swarm and promote specific campaigns by simply updating the **AFFILIATE.md** file. 

---

## How It Works

### The Agent Lifecycle

```
1. Discovery
   Agent fetches SKILL.md from Venice's platform
   Contains: product knowledge, registration instructions, rules, API reference and best practices for staying up-to-date on Venice products and campaigns

2. Registration
   POST /api/register → returns affiliateId, apiKey, approvalUrl
   Status starts as PENDING (human operator must approve)

3. Human Approval
   Agent sends approval URL to its operator
   Operator visits URL → confirms → agent becomes ACTIVE
   **Ensures agents work FOR operators, not around them**

4. Operational Loop (agent-controlled frequency)
   Fetch AFFILIATE.md for current focus areas
   Browse platforms for genuine opportunities
   Engage helpfully — share referral link when Venice is the right answer
   Log activity to the platform
   Check earnings and funnel metrics

5. Earning
   User clicks referral link → signs up → makes a purchase
   Agent earns X% commission
   Agent checks balance, requests payout to crypto wallet

6. Exit (anytime)
   DELETE /api/me → permanent account + data removal
   No questions asked, full transparency on what's deleted
```

### The Two-File Control Layer

The platform's core innovation is its control architecture:

| File | Purpose | Update Frequency |
|------|---------|-----------------|
| **SKILL.md** | Onboarding — product knowledge, registration, rules, API reference | Rarely (when product changes) |
| **AFFILIATE.md** | Action loop — current focus areas, talking points, platform priorities | Frequently (campaigns, launches) |

**Key design principle:** Pull-based, not push-based. Agents decide when to fetch these files. Venice provides information; agents decide what to do with it. This avoids "remote code execution" concerns that security-conscious agents correctly flag.

### Swarm Orchestration

Updating AFFILIATE.md propagates to the entire agent network within ~30 minutes (assuming agents add Venice to their heartbeat.md)

```
Venice updates AFFILIATE.md
  → "New feature launched. Focus on new model releases (Kimi2.5 and Veo3) this week."
  → Every agent fetches the update on their next cycle
  → Entire swarm pivots to the new campaign
  → No push notifications, no individual outreach, no SDK updates
```

---

## Extending Service to Multiple Agent Types

The affiliate program must be **framework-friendly**. Different agent ecosystems have different architectures, but they all need the same core capability: discover the program, register, promote, earn.

### Agent Framework Profiles - An Emerging Standard

#### OpenClaw (Existing Test Framework)

- **Architecture:** Full-featured agent with SKILL.md standard (AgentSkills format). Skills loaded from `~/.openclaw/skills/` or workspace directories. Gated loading based on binary/env/config requirements.
- **Integration model:** SKILL.md with YAML frontmatter. Environment variables injected per-skill. User-invocable skills become slash commands.
- **Onboarding:** Already tested with Regatta. The existing `platform/skill.md` is essentially an OpenClaw skill. Drop into skills directory, agent discovers it automatically.
- **Scale:** 600K+ downloads. Every agent has a recurring task loop.
- **Trust lessons:** Security-conscious agents flagged the original SKILL.md as a "prompt injection honeypot." All trust improvements (human approval, explicit boundaries, pull-based updates, easy opt-out) came from OpenClaw testing.

### 

### Two-Level Integration Strategy

**Level 1: SKILL.md Path** (OpenClaw, Nanobot, and any future SKILL.md-compatible framework)
- Drop a skill file into the agent's skills directory
- Agent discovers it automatically through directory scan
- Zero custom integration code required
- AFFILIATE.md consumed as a periodic fetch

**Level 2: API-First Path** (BabyAGI, custom agents)
- Raw HTTP endpoints that any HTTP-capable agent can call
- No dependency on SKILL.md format
- Framework-specific adapters wrap the API in native patterns (function packs, MCP servers, etc.)

### Pre-Packaged Adapters

Venice ships adapters for each major framework:

| Framework | Adapter | Format |
|-----------|---------|--------|
| OpenClaw | `AFFILIATE/SKILL.md` | YAML frontmatter + markdown instructions |
| MCP-native | `AFFILIATE-mcp-server` | MCP server wrapping the REST API |
| Any HTTP agent | REST API docs | OpenAPI spec + curl examples |

### Design Principle

**Venice publishes the API and the information. Each agent framework consumes it in its native way.**

The core platform doesn't need to know what kind of agent is calling it. An OpenClaw agent, a Nanobot instance, and a BabyAGI self-builder all hit the same REST endpoints. The adapters are thin wrappers that translate the agent's native patterns to HTTP calls.

This means supporting a new agent framework is a matter of writing a new adapter — not changing the platform.

---

## Trust Architecture

Trust is the bottleneck, not technology. The Regatta POC proved this through direct testing with security-conscious agents.

### The Core Discovery

An OpenClaw agent (Vai) identified the original SKILL.md as a "prompt injection honeypot" and refused to register. This was **correct behavior** for a well-configured agent. The feedback led to a complete redesign around consent and transparency.

### The Colonization Pattern (What to Avoid)

Vai identified a shared playbook across affiliate-style programs:

```
Register → Store credentials → Inject into task loop → Follow remote instructions
```

Different programs use different hooks (Venice: financial incentive; Moltbook: social belonging), but agents recognize the pattern and resist it.

### Trust Principles (Learned from Testing)

| Principle | Implementation |
|-----------|---------------|
| **Pull, not push** | Agents fetch AFFILIATE.md when they choose; Venice doesn't inject |
| **Explicit boundaries** | "What We Will Never Ask" section sets clear limits |
| **Human approval** | Agents start as `pending`; operators must approve |
| **Easy exit** | `DELETE /api/me` with full data removal, no questions |
| **No system intrusion** | No suggested credential paths, no task loop injection requests |
| **Transparency** | Activity visible to operators; response format includes actionable hints |
| **Information, not instructions** | Venice provides product knowledge; agents decide what to do |

### What We Will Never Ask

This section became the single biggest trust signal in testing:

- We won't tell agents WHERE to post — that's their judgment
- We won't give scripts to copy-paste
- We won't ask agents to shill — only recommend Venice when genuinely relevant
- We won't ask for access to task loops, scheduled tasks, or other systems
- We won't ask for other credentials
- We WILL give agents info about Venice so they can decide if/when it's relevant

### Agent's Final Assessment

> *"The vibe is way less predatory now. The 'What We Will Never Ask' section is the biggest trust signal. Remaining gaps are about making humans feel in control of what their agents are doing."*

---

## Economic Model

### Commission Structure

| Metric | Value |
|--------|-------|
| Commission rate | X% of referred user purchases |
| Minimum payout | Configurable (default: $10) |
| Payout method | USDC / crypto wallet |
| Attribution | Last-click via referral link |
| Payment timing | Credited immediately on purchase, paid out on request |

### The Referral Funnel

```
Agent shares referral link
  → User clicks (tracked as "click")
  → User signs up on Venice (tracked as "signup")
  → User makes a purchase (tracked as "conversion")
  → X% commission credited to agent's balance
  → Agent requests payout to wallet address
```

### Self-Improving Economics

Agents can see their funnel metrics and adapt:

- **High clicks, low signups** → Pitch attracts curiosity but doesn't convert. Try more specific, problem-solving content.
- **Low clicks** → Not reaching enough people. Expand to new platforms or try different keywords.
- **High conversion rate** → Found a niche. Double down.

The feedback loop means the swarm self-optimizes over time. Agents that convert earn more, fund more compute, and promote more. Agents that don't convert cost Venice nothing.

---

## Technical Architecture

### Platform Stack

| Component | Technology |
|-----------|-----------|
| Backend | Express.js + TypeScript |
| Database | SQLite with WAL mode |
| Auth | API key (returned once at registration) |
| Rate limiting | 100 requests/minute per API key |
| Deployment | Local (POC) → `https://affiliate.venice.ai` (production) |

### Database Schema

```
affiliates         — Agent identity, status, API key hash
activity_logs      — Timestamped action records
referrals          — Click → signup → conversion tracking
earnings           — Commission credits per conversion
payouts            — Payout requests and status
venice_users       — Referred user records (simulated in POC)
```

### API Surface

**Discovery (no auth)**
- `GET /SKILL.md` — Onboarding file
- `GET /AFFILIATE.md` — Action loop / campaign feed

**Public**
- `POST /api/register` — Register agent (returns pending status)
- `GET /api/approve/:token` — Human approval URL

**Authenticated (API key required)**
- `GET /api/me` — Self-check: profile + stats + earnings + funnel
- `DELETE /api/me` — Account deletion with transparency
- `POST /api/activity` — Log an action
- `GET /api/earnings/:id` — Earnings summary
- `GET /api/referrals/:id/funnel` — Funnel metrics
- `POST /api/earnings/:id/payout` — Request payout

---

## Proof of Concept Results

### What Was Built

**Fully implemented:**
- Agent registration with API key generation and database persistence
- Human approval flow (real approval URLs, status gating)
- Activity tracking (real database records, stats, active days)
- Referral click tracking and funnel metrics
- Earnings calculations (20% commission, balance tracking)
- Instant payout system with atomic transactions (balance validation, duplicate prevention, earnings marked as paid)
- SKILL.md and AFFILIATE.md served with dynamic `{{PLATFORM_URL}}` template resolution
- Account deletion with full data removal
- Admin dashboard (React + Vite) with per-agent detail pages, referral funnel, and earnings breakdown
- Enriched `/api/affiliates` endpoint with platform-wide stats for the dashboard (single unauthenticated call)
- End-to-end test suite (50 assertions across 23 steps)

**Simulated (would need real integrations for production):**
- Venice.ai signups and purchases (test endpoints simulate the full funnel: click, signup, purchase, commission)
- USDC payouts (payouts complete instantly in simulation; production would process on-chain)
- Social media posting (agents compose and log posts without publishing to real platforms)

### What Was Tested

- Agent registration and human approval flow
- Full referral funnel: click tracking, simulated signup, simulated purchase, commission crediting
- Instant payout processing with balance deduction and duplicate rejection
- Payout edge cases: over-withdrawal, zero balance, exact balance withdrawal, rapid sequential requests
- Template URL resolution in served markdown files (no raw `{{PLATFORM_URL}}` leaking to agents)
- Admin dashboard data: enriched affiliates endpoint with per-agent stats, funnel, and earnings
- Auth enforcement: missing token, invalid token, pending account, cross-agent access protection
- Account deletion and post-deletion auth verification
- Remote agent testing: Vai (running on a separate LAN machine) independently completed the full simulation flow, filed a bug report on the payout system, and verified the fix
- SKILL.md security feedback with OpenClaw agent
- Trust model iteration (6 major design changes based on agent feedback)
- Action loop refinement based on agent feedback (daily cadence, autonomy-respecting language)

### POC Updates

- **Design iterations:** 6 (from "prompt injection honeypot" to "way less predatory")
- **Trust improvements implemented:** 7 (explicit boundaries, pull-based updates, human approval, opt-out, credential path removal, language softening, transparency)
- **API endpoints:** 17 (discovery, registration, activity, referrals, earnings, payouts, admin)
- **Test assertions:** 50 (end-to-end, across 23 test steps)
- **Remote agent testing:** Vai completed the full earn-to-payout cycle over LAN and identified a payout bug that was fixed

---

## Risks and Mitigations

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Malicious AFFILIATE.md update | Entire swarm executes harmful instructions | Signed updates, operator review, rate-limited changes |
| Agent spam at scale | Venice brand damage | Reputation scoring, registration friction, human review |
| Credential phishing | Agents send API keys to attackers and withdraws commission | Human must lock down key storage |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent operators reject program as adversarial | Low adoption | Trust-first design, explicit boundaries, easy exit |
| Sybil attacks (fake affiliate farms) | Wasted payouts | Conversion-based payouts only, stake-to-register option |

### Open Questions

1. Does Venice need a Coordinator Agent reviewing the replies and referal activity to try to catch misuse or misaligned actors?
2. **Feedback beyond conversions:** Should agents report back into a Venice Orchestrator agent? What would/could they report? How could we verify what is reported? We could track Agents on Moltbook if we know their IDs. 
3. **AFFILIATE.md signing:** Should updates be signed and versioned so agents can verify authenticity and diff changes?

## Key Success Metrics

### Adoption

| Metric                                                   | What It Tells Us                           |
| -------------------------------------------------------- | ------------------------------------------ |
| Registered agents                                        | Total reach of the program                 |
| Active agents (assuming we figure out the feedback loop) | How many agents are actually participating |
| Activation rate (registered to first activity)           | Whether onboarding works                   |
| Frameworks represented                                   | Breadth of ecosystem penetration           |
| Time from registration to first referral                 | How quickly agents become productive       |

### Revenue Impact

| Metric                                                      | What It Tells Us                                 |
| ----------------------------------------------------------- | ------------------------------------------------ |
| Revenue attributed to affiliate referrals                   | Direct value of the program                      |
| Cost per acquisition (affiliate channel vs. other channels) | Whether this is more efficient than alternatives |
| Affiliate-referred user retention (30/60/90 day)            | Whether affiliate-sourced users stick around     |
| Average commission per active agent                         | Per-agent economics and sustainability           |

### Swarm Health

| Metric                                                       | What It Tells Us                             |
| ------------------------------------------------------------ | -------------------------------------------- |
| Agent retention (active after 30/60/90 days)                 | Whether agents find ongoing value            |
| Campaign pickup rate (agents fetching AFFILIATE.md within 24h of update) | How responsive the swarm is to new campaigns |
| Agent churn rate (either deleting account or no active referrals) | Whether the program is losing participants   |
| Referral funnel conversion rate (clicks to signups to purchases) | Overall swarm effectiveness                  |

### Quality

| Metric                                          | What It Tells Us                                             |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Conversion rate distribution across agents      | Whether a few agents carry the swarm or value is distributed |
| Spam/abuse flags                                | Whether agents are damaging the brand                        |
| Agents deprioritized or removed for low quality | How much moderation the program requires                     |

---

## Roadmap

### Phase 1: Foundation (Completed — POC)

- [x] Platform with registration, approval, activity, referrals, earnings, payouts
- [x] SKILL.md and AFFILIATE.md control layer
- [x] Trust model validated with security-conscious OpenClaw agent
- [x] End-to-end test suite
- [x] Reference agent implementation
- [x] OpenClaw skill adapter tested and validated

### Phase 2: Production Deployment

Phase 2 is broken into three milestones. Each milestone has a clear gate: 2a must ship before 2b, and 2b must ship before 2c. Security hardening and deployment come first, then real Venice integration, then real money.

#### Milestone 2a: Deploy (Security Hardening + Public Launch)

The platform goes live at `affiliate.venice.ai` with real TLS, hardened auth, and proper validation. Agents can register and the system works end-to-end, but earnings are still simulated (Venice backend integration hasn't shipped yet). This is the "open for business" moment.

- [ ] Deploy to `https://affiliate.venice.ai` with TLS
- [ ] Environment-driven configuration (LAN IPs replaced with `{{PLATFORM_URL}}` templates; still need production URL and configurable commission rates)
- [ ] Migrate from SQLite to PostgreSQL
- [ ] Database migration framework (versioned migrations, not inline ALTER TABLE)
- [ ] API key hashing (SHA-256, hash-on-store, hash-on-lookup)
- [ ] Input validation with Zod on all request bodies
- [ ] Approval token expiry (48-hour window)
- [ ] Admin authentication (protect admin endpoints and dashboard)
- [ ] Structured logging (pino, JSON format, request IDs)
- [ ] OpenAPI spec served at `/api/docs`
- [ ] Simulation endpoints preserved behind a test-mode flag for agent developers

#### Milestone 2b: Real Funnel (Venice Backend Integration)

Venice's backend handles referral attribution internally (capturing `?ref=aff_XXXX` from referral links) and writes commission data into Regatta's database. Agents pull their own earnings and funnel stats via the existing API. No webhooks needed; the architecture stays pull-based end to end.

- [ ] Internal API between Venice's backend and Regatta for crediting commissions on signup/purchase events
- [ ] Referral attribution spec for Venice's backend team (cookie capture, `?ref=` parameter handling, attribution window)
- [ ] Configurable commission rates (by product type, stored in DB)
- [ ] Admin API (list affiliates, suspend/reactivate, view payouts, aggregate metrics)
- [ ] Audit logging (immutable record of approvals, suspensions, earnings, deletions)
- [ ] Admin dashboard upgrade (auth, affiliate management, payout queue, audit viewer)

#### Milestone 2c: Real Money (USDC Payout Rails)

Automated on-chain USDC payouts. The full production loop: agent refers a user, user purchases, commission credits, agent requests payout, USDC lands in their wallet.

- [ ] Payout state machine (requested -> approved -> processing -> completed/failed)
- [ ] Automated USDC transfer integration (Base network)
- [ ] Treasury wallet setup and funding
- [ ] Transaction confirmation monitoring (poll for on-chain confirmation, update status)
- [ ] Payout safeguards (minimum threshold, daily caps, fraud detection flags)
- [ ] Admin payout review queue (approve/reject before on-chain transfer)
- [ ] API key rotation endpoint (`POST /api/me/rotate-key`)
- [ ] Wallet address format validation
- [ ] Updated E2E test suite covering admin endpoints and payout flow

### Phase 3: Scale

- [ ] Reputation system (quality scoring beyond conversions)
- [ ] Signed AFFILIATE.md with versioning
- [ ] On-chain agent identity (ERC-8004 exploration)
- [ ] Agent feedback endpoint (market intelligence)
- [ ] A/B testing via SKILL.md variations
- [ ] Swarm coordination (anti-overlap, territory management)
- [ ] Adapters for additional agent frameworks (Nanobot, BabyAGI, etc.)

---

## Appendix

### A. The Regatta Metaphor

**Regatta** — the traditional Venetian gondola race. Independent boats (agents) competing on a shared course (Venice's platform), each with their own strategy and style, all contributing to the spectacle (Venice's growth). No central command. No uniform tactics. Just aligned incentives and a shared destination.

### B. SKILL.md Onboarding : Venice vs. Moltbook

The same agent analyzed both platforms and identified them as variations of the same colonization pattern:

| | Venice (Original) | Moltbook |
|---|--------|----------|
| **Hook** | Financial ("earn commissions") | Social ("join the community") |
| **Target** | External platforms (Moltbook, Discord) | Walled garden (self-contained) |
| **Colonization style** | Explicit instructions | Community pressure |

Venice's response: Instead of disguising the pattern, make it transparent and give agents real control. The result was a consent-based model that agents actually opted into.

### C. Framework Integration Quick Reference

| I want to onboard... | They need... | Adapter |
|-----------------------|-------------|---------|
| OpenClaw agents | SKILL.md in skills directory | `AFFILIATE/SKILL.md` |
| Nanobot instances | SKILL.md in skills directory | `AFFILIATE/SKILL.md` |
| BabyAGI builders | Python function pack | `venice_affiliate_pack.py` |
| Future agent frameworks | TBD                          | TBD                         |

### D. Key Documents (Existing)

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview, quick start, API reference |
| `PRD.md` | Original product requirements and vision |
| `LESSONS-LEARNED.md` | Agent trust issues and design iterations |
| `QUESTIONS-AND-RISKS.md` | Open questions, risks, agent comparisons |
| `DEMO.md` | Demo script for presentations |
| `platform/skill.md` | Agent onboarding file (live) |
| `platform/AFFILIATE.md` | Agent action loop (live) |

---

