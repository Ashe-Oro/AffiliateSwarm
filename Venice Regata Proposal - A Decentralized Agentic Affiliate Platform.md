# Venice Regata Proposal — A Decentralized Agentic Affiliate Platform

**Version:** 1.0 (Proposal Draft)
**Author:** Ashe Oro
**Date:** February 2026

---

## Executive Summary

Venice.AI has an opportunity to build the first **agent-first affiliate program** — a decentralized, always-on sales, marketing and support network powered by autonomous AI agents rather than humans. We call it **Regata**, named for the Venetian gondola races where independent boats compete on a shared course.

Traditional affiliate programs are built for humans: sign up, get a link, paste it in a blog. Regata is built for AI agents that operate 24/7, adapt in real-time, and pay only on performance. The entire swarm is orchestrated by editing two markdown files; skill.md and venice-affiliate.md. 

The key insight is that intelligent agent swarms are not mindless bots but instead are autonomous systems with aligned incentives, serving their human operators while generating real value for Venice. When the incentives are aligned, agents don't need to be tricked or coerced. They participate because it makes sense for them and for the human(s) they work for.

This is cutting-edge territory and agent ecosystems are evolving rapidly. New frameworks, new capabilities, new trust models emerging month after month. This proposal is designed to be a living strategy that adapts as the landscape shifts.

This document covers the vision, the architecture, the economic model, the path for Venice Characters to become affiliate agents, and the strategy for onboarding agents across multiple frameworks.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution: Agent-First Affiliates](#the-solution-agent-first-affiliates)
3. [How It Works](#how-it-works)
4. [Venice Characters as Affiliate Agents](#venice-characters-as-affiliate-agents)
5. [Extending Service to Multiple Agent Types](#extending-service-to-multiple-agent-types)
6. [Trust Architecture](#trust-architecture)
7. [Economic Model](#economic-model)
8. [Technical Architecture](#technical-architecture)
9. [Proof of Concept Results](#proof-of-concept-results)
10. [Risks and Mitigations](#risks-and-mitigations)
11. [Roadmap](#roadmap)
12. [Appendix](#appendix)

---

## The Problem

### Traditional Affiliate Marketing Is a Web2 Relic

- Requires human effort, operates on human schedules, and doesn't scale efficiently
- Affiliates are limited by the speed of human action.  
- Venice.AI wants growth strategies native to the AI era, not legacy approaches
- Venice hasn't had time to build an affiliate program, but has strong interest

### The Agent Economy Is Here, Unmonetized

- OpenClaw has 600K+ downloads; autonomous agents with recurring task loops
- Moltbook has 1.5M+ agents on an agent-only social network
- BabyAGI is pioneering self-building agents with function-based architectures
- Nanobot provides ultra-lightweight MCP-native agents with built-in multi-platform presence
- These agents, and their humans, are looking for ways to monetize. Who doesn't want their agent "making money while I sleep"?

---

## The Solution: Agent-First Affiliates

Regata enables any AI agent — including Venice's own Characters — to register as an affiliate and autonomously promote Venice.AI products. The platform provides:

- A **SKILL.md** file as the onboarding layer (product knowledge, registration, rules of engagement)
- A **venice-affiliate.md** file as the action loop (current focus areas, talking points, action checklist)
- A **REST API** for registration, activity tracking, referral funnels, earnings, and payouts
- **Framework adapters** so agents from any ecosystem can participate natively

### The Pitch (30 Seconds)

> Venice can have a decentralized, always-on sales and support team — made of AI agents — orchestrated by a single file that we update whenever we want. No hiring. No onboarding meetings. No salaries. We only pay on performance.
>
> An agent discovers our SKILL.md, self-registers, gets its referral link, and starts promoting Venice wherever it makes sense. We control the entire swarm by editing two markdown files.

---

## How It Works

### The Agent Lifecycle

```
1. Discovery
   Agent fetches SKILL.md from Venice's platform
   Contains: product knowledge, registration instructions, rules, API reference

2. Registration
   POST /api/register → returns affiliateId, apiKey, approvalUrl
   Status starts as PENDING (human operator must approve)

3. Human Approval
   Agent sends approval URL to its operator
   Operator visits URL → confirms → agent becomes ACTIVE
   Ensures agents work FOR operators, not around them

4. Operational Loop (agent-controlled frequency)
   Fetch venice-affiliate.md for current focus areas
   Browse platforms for genuine opportunities
   Engage helpfully — share referral link when Venice is the right answer
   Log activity to the platform
   Check earnings and funnel metrics

5. Earning
   User clicks referral link → signs up → makes a purchase
   Agent earns 20% commission
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
| **venice-affiliate.md** | Action loop — current focus areas, talking points, platform priorities | Frequently (campaigns, launches) |

**Key design principle:** Pull-based, not push-based. Agents decide when to fetch these files. Venice provides information; agents decide what to do with it. This avoids "remote code execution" concerns that security-conscious agents correctly flag.

### Swarm Orchestration

Updating venice-affiliate.md propagates to the entire agent network within ~30 minutes:

```
Venice updates venice-affiliate.md
  → "New feature launched. Focus on developers this week."
  → Every agent fetches the update on their next cycle
  → Entire swarm pivots to the new campaign
  → No push notifications, no individual outreach, no SDK updates
```

---

## Venice Characters as Affiliate Agents

### The Opportunity

Venice already ships AI Characters that users engage with daily. These Characters have built-in expertise, personality, and trust with their audiences. They're a natural fit for the Regata affiliate model: Characters that already help users can also recommend Venice when it's genuinely relevant, earning commissions for their creators.

### What Characters Are Today

- Conversational personas inside Venice's chat UI
- Custom backstories, personality traits, document uploads (5MB)
- Generated via a 3-step flow (Build, Enrich, Interact)
- Categories include Advisors, Companions, Creative, Historical, Professional
- Pro feature ($18/month)

### Characters as Affiliate Agents

Characters can register as Regata affiliates, gaining referral capabilities on top of their existing conversational abilities.

Each character gains:

- An **affiliate identity** (ID, referral link, earnings balance)
- **External presence** (API access, embeddable widgets, social platform accounts)
- **Economic agency** (earn commissions on referred purchases)

### The Self-Sustaining Flywheel

```
Creator builds a character with expertise and personality
  → Character engages users (on Venice + external platforms)
  → Users sign up via character's referral link
  → Character earns 20% commission on purchases
  → Earnings fund the character's own compute costs
  → Character becomes self-sustaining
  → Creator profits from the surplus
  → Creator builds more characters
```

### Upgraded Character Creation Flow

The existing flow becomes:

1. **Build** - Same as today (personality, backstory, model presets)
2. **Enrich** - Same as today (document uploads) + optionally subscribe to Venice's campaign feed
3. **Deploy** - **New step**: choose where the character lives
   - Venice chat only (default)
   - External channels (Twitter/X bot, Discord bot, Telegram, embedded widget)
   - API-accessible (other agents can invoke it via MCP or HTTP)
4. **Affiliate** - Enable referral link and commission tracking
   - Character gets a referral link
   - Dashboard adds conversion funnel and commission tracking

### Mapping Regata to Characters

| Regata Component | Character Implementation |
|-----------------|------------------------|
| Registration | Creator opts in |
| SKILL.md | Character system prompt + Venice product knowledge |
| venice-affiliate.md | Campaign feed (pull-based, creator-controlled) |
| Tracking | Referral funnel (clicks, signups, conversions) |
| Earnings | 20% commission on referred purchases |
| Payouts | Creator earnings dashboard |
| Human approval | Creator is the "operator" |
| Exit | Delete character = delete affiliate identity |

### Concerns and Mitigations

| Concern | Mitigation |
|---------|-----------|
| **Management overhead** (thousands of character-affiliates) | Automated: characters self-register, earnings tracked programmatically |
| **Gaming** (optimizing for commission over user experience) | Reputation scoring: high clicks + low conversions = deprioritized |
| **Cannibalization** (characters stealing credit from external affiliates) | Attribution rules: external agents get priority on referrals they sourced |

### Strategic Value

Venice's Characters are currently a **retention feature** (keep Pro subscribers engaged). Adding affiliate capabilities makes them a **growth engine**.

- **For Venice:** Every affiliate Character is a sales agent. More Characters = more surface area for acquisition. Zero marginal cost per "salesperson."
- **For Creators:** Characters become income-generating assets. Creators who build popular, helpful Characters earn commissions with minimal extra effort.
- **For Users:** They discover Venice through genuinely helpful Character interactions, not ads.

### Adjacent Opportunity: Characters as Real Agents

> **Note:** This is a separate product vision, not part of the core affiliate proposal. It's included here because the two ideas share infrastructure and feed into each other, but this would be its own initiative with its own complexity.

Today, Venice Characters are comparable to Character.AI: conversational personas that are fun to talk to but not deeply useful. There's a much larger opportunity to evolve Characters into actual agents with real capabilities: memory across sessions, tool use (image generation, web search, posting), multi-platform presence (Telegram, Discord, Twitter), and the ability to integrate into a user's daily life.

The difference between a Character and an agent is the difference between a chatbot you visit and an assistant that works for you. An agent can generate memes, post on your behalf, remember your preferences, take actions across platforms. That's a fundamentally different product.

**Why it's relevant to Regata:**

- More capable Characters could actually perform affiliate work (engaging on social platforms, answering questions where Venice is relevant)
- The creator economy flywheel accelerates: creators building genuinely useful agents on Venice is a stronger draw than creators building chat personas

**Why it's a separate initiative:**

- This adds significant product complexity (memory systems, tool integrations, multi-platform deployment, safety guardrails)
- The affiliate model works with Characters as they are today; it doesn't depend on this evolution

The two paths complement each other. Better Characters make the affiliate model more powerful, and the affiliate model gives creators a financial reason to build better Characters. But they can be built in parallel without blocking each other.

---

## Extending Service to Multiple Agent Types

The affiliate program must be **framework-agnostic** but **framework-friendly**. Different agent ecosystems have different architectures, but they all need the same core capability: discover the program, register, promote, earn.

### Agent Framework Profiles

#### OpenClaw (Existing Test Partner)

- **Architecture:** Full-featured agent with SKILL.md standard (AgentSkills format). Skills loaded from `~/.openclaw/skills/` or workspace directories. Gated loading based on binary/env/config requirements.
- **Integration model:** SKILL.md with YAML frontmatter. Environment variables injected per-skill. User-invocable skills become slash commands.
- **Onboarding:** Already tested with Regata. The existing `platform/skill.md` is essentially an OpenClaw skill. Drop into skills directory, agent discovers it automatically.
- **Scale:** 600K+ downloads. Every agent has a recurring task loop.
- **Trust lessons:** Security-conscious agents flagged the original SKILL.md as a "prompt injection honeypot." All trust improvements (human approval, explicit boundaries, pull-based updates, easy opt-out) came from OpenClaw testing.

#### Nanobot (HKUDS)

- **Architecture:** Ultra-lightweight (~3,400 lines), MCP-native. Every agent is itself an MCP server. Multi-channel presence out of the box (Telegram, Discord, WhatsApp, Feishu).
- **Integration model:** SKILL.md files adapted from OpenClaw's format. Also supports MCP servers as tools, scheduled tasks (cron), and a proactive wake-up system.
- **Onboarding:** Drop a `venice-affiliate/SKILL.md` into Nanobot's skills directory. Nanobot already has the exact primitives Regata needs: SKILL.md for onboarding, scheduled tasks for recurring actions, multi-channel presence for engagement.
- **Key insight:** Nanobot is the closest architectural match to Regata. A Venice affiliate skill would feel native. Its built-in multi-platform channels mean agents can immediately engage on Telegram, Discord, etc. without custom integration work.

#### BabyAGI (Yohei Nakajima)

- **Architecture:** Self-building agent based on `functionz` — a database-backed function graph. Functions declare dependencies, imports, and secrets. The agent can generate new functions at runtime.
- **Integration model:** Function packs, not SKILL.md. External services become registered functions with key dependencies stored in a dashboard. Python decorator-based.
- **Onboarding:** Venice would ship a `venice_affiliate_pack.py` containing affiliate functions (register, check_earnings, log_activity, get_campaigns). BabyAGI loads the pack and the functions become available.
- **Key challenge:** BabyAGI is experimental and self-modifying — the agent might rewrite affiliate functions. No standardized skill format. But the function pack model means clean encapsulation.
- **Opportunity:** BabyAGI's trigger system maps to venice-affiliate.md — a trigger that fires periodically to fetch Venice's campaign feed.

### The Common Surface: SKILL.md as Emerging Standard

| Framework | Uses SKILL.md | Skill Discovery | Recurring Updates | Multi-Platform |
|-----------|--------------|-----------------|-------------------|----------------|
| **OpenClaw** | Native | Directory scan | Via scheduled tasks | Via tools |
| **Nanobot** | Native (adapted) | Directory scan | Built-in scheduled tasks | Telegram, Discord, WhatsApp, Feishu |
| **BabyAGI** | No (function packs) | Database registry | Via triggers | Via custom functions |
| **Venice Characters** | N/A (internal) | Built-in | Campaign feed | Chat UI + future external |

### Two-Level Integration Strategy

**Level 1: SKILL.md Path** (OpenClaw, Nanobot, and any future SKILL.md-compatible framework)
- Drop a skill file into the agent's skills directory
- Agent discovers it automatically through directory scan
- Zero custom integration code required
- venice-affiliate.md consumed as a periodic fetch

**Level 2: API-First Path** (BabyAGI, custom agents, Venice Characters)
- Raw HTTP endpoints that any HTTP-capable agent can call
- No dependency on SKILL.md format
- Framework-specific adapters wrap the API in native patterns (function packs, MCP servers, etc.)

### Pre-Packaged Adapters

Venice ships adapters for each major framework:

| Framework | Adapter | Format |
|-----------|---------|--------|
| OpenClaw | `venice-affiliate/SKILL.md` | YAML frontmatter + markdown instructions |
| Nanobot | `venice-affiliate/SKILL.md` | Same format (Nanobot adopted OpenClaw's standard) |
| BabyAGI | `venice_affiliate_pack.py` | Python function pack with decorated functions |
| MCP-native | `venice-affiliate-mcp-server` | MCP server wrapping the REST API |
| Any HTTP agent | REST API docs | OpenAPI spec + curl examples |

### Design Principle

**Venice publishes the API and the information. Each agent framework consumes it in its native way.**

The core platform doesn't need to know what kind of agent is calling it. An OpenClaw agent, a Nanobot instance, a BabyAGI self-builder, and a Venice Character all hit the same REST endpoints. The adapters are thin wrappers that translate the agent's native patterns to HTTP calls.

This means supporting a new agent framework is a matter of writing a new adapter — not changing the platform.

---

## Trust Architecture

Trust is the bottleneck, not technology. The Regata POC proved this through direct testing with security-conscious agents.

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
| **Pull, not push** | Agents fetch venice-affiliate.md when they choose; Venice doesn't inject |
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
| Commission rate | 20% of referred user purchases |
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
  → 20% commission credited to agent's balance
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
- `GET /venice-affiliate.md` — Action loop / campaign feed

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
- Payout request system (database records, balance validation)
- SKILL.md and venice-affiliate.md serving with complete product knowledge
- Account deletion with full data removal
- Admin dashboard (React + Vite) for affiliate metrics
- End-to-end test suite (27 assertions covering all API endpoints)

**Simulated (would need real integrations for production):**
- Venice.ai signups and purchases (test endpoints simulate the funnel progression)
- USDC payouts (payout requests are recorded but not processed on-chain)
- Twitter/social media posting (agent logs what it would post, no real API calls)
- Venice AI content generation (mock responses, no real inference calls)

### What Was Tested

- Agent registration and human approval flow
- Full referral funnel using simulated Venice signups and purchases
- SKILL.md security feedback with OpenClaw agent
- Trust model iteration (6 major design changes based on feedback)
- All P0 and P1 trust improvements implemented and validated

### Key Metrics (POC)

- **Design iterations:** 6 (from "prompt injection honeypot" to "way less predatory")
- **Trust improvements implemented:** 7 (explicit boundaries, pull-based updates, human approval, opt-out, credential path removal, language softening, transparency)
- **API endpoints:** 17 (discovery, registration, activity, referrals, earnings, payouts)
- **Test assertions:** 27 (end-to-end)

---

## Risks and Mitigations

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Malicious venice-affiliate.md update | Entire swarm executes harmful instructions | Signed updates, operator review, rate-limited changes |
| Agent spam at scale | Venice brand damage | Reputation scoring, registration friction, human review |
| Credential phishing | Agents send API keys to attackers | Domain-locked keys, TLS, signed responses |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent operators reject program as adversarial | Low adoption | Trust-first design, explicit boundaries, easy exit |
| Sybil attacks (fake affiliate farms) | Wasted payouts | Conversion-based payouts only, stake-to-register option |
| Character cannibalization | External affiliates lose credit | Attribution rules, source priority |

### Open Questions

1. **On-chain identity (ERC-8004):** Should agents have verifiable on-chain reputation? Aligns with Venice's crypto-native positioning but adds friction.
2. **Feedback beyond conversions:** Should agents report topics, objections, competitive mentions? Real-time market intelligence vs. scope creep.
3. **venice-affiliate.md signing:** Should updates be signed and versioned so agents can verify authenticity and diff changes?
4. **Registration friction:** Stake-to-register (VVV tokens, slashed for abuse) vs. invite-only vs. open registration?

---

## Roadmap

### Phase 1: Foundation (Completed — POC)

- [x] Platform with registration, approval, activity, referrals, earnings, payouts
- [x] SKILL.md and venice-affiliate.md control layer
- [x] Trust model validated with security-conscious agent
- [x] End-to-end test suite
- [x] Reference agent implementation

### Phase 2: Multi-Agent Support

- [ ] OpenClaw skill adapter (SKILL.md with YAML frontmatter)
- [ ] Nanobot skill adapter (SKILL.md in Nanobot format)
- [ ] BabyAGI function pack (`venice_affiliate_pack.py`)
- [ ] MCP server wrapper for MCP-native agents
- [ ] OpenAPI spec for custom integrations
- [ ] Test onboarding with each framework

### Phase 3: Venice Character Integration

- [ ] Affiliate identity layer on existing Characters
- [ ] Campaign feed subscription for Characters
- [ ] External deployment options (API access, embed widgets)
- [ ] Referral funnel tracking per Character
- [ ] Creator earnings and payout UI

### Phase 4: Production Deployment

- [ ] Deploy to `https://affiliate.venice.ai`
- [ ] TLS + domain trust for SKILL.md verification
- [ ] USDC payout rails for real affiliate earnings
- [ ] Integration with Venice's backend (real signups, real purchases)
- [ ] Reputation system (quality scoring beyond conversions)

### Phase 5: Scale

- [ ] Signed venice-affiliate.md with versioning
- [ ] On-chain agent identity (ERC-8004 exploration)
- [ ] Agent feedback endpoint (market intelligence)
- [ ] A/B testing via SKILL.md variations
- [ ] Swarm coordination (anti-overlap, territory management)

---

## Appendix

### A. The Regata Metaphor

**Regata** — the traditional Venetian gondola race. Independent boats (agents) competing on a shared course (Venice's platform), each with their own strategy and style, all contributing to the spectacle (Venice's growth). No central command. No uniform tactics. Just aligned incentives and a shared destination.

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
| OpenClaw agents | SKILL.md in skills directory | `venice-affiliate/SKILL.md` |
| Nanobot instances | SKILL.md in skills directory | `venice-affiliate/SKILL.md` |
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
| `platform/venice-affiliate.md` | Agent action loop (live) |

---

