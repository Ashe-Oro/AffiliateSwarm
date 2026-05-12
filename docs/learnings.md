# AffiliateSwarm — Learnings & Decisions Log

A running record of product decisions, pivots, and lessons learned during the development of AffiliateSwarm. Not a changelog — this captures the *why* behind choices so we can review our thinking later.

---

## Product & Strategy

### Pivot: Agent-only marketplace to human+agent platform
**Date:** ~March 2026
**Context:** AffiliateSwarm was originally conceived as infrastructure exclusively for AI agent swarms — a marketplace where autonomous agents would discover campaigns, promote products, and earn commissions without any human involvement.

**What changed:** After research and early development, it became clear that the AI agent ecosystem is not yet developed enough to sustain a purely agent-to-agent marketplace. The reality of the current environment is that humans still use agents as tools and as their gateway to services. Agents don't yet operate fully autonomously at scale — they work on behalf of humans who direct them.

**Decision:** Pivot to a hybrid model where both humans and agents can use the platform. Built a full web UI and dashboard for human users, while keeping the API-first architecture so agents remain first-class citizens. The marketing positioning shifted from "built for agent swarms" to "your agent does the work, you see the results."

**Impact:** This unlocked the entire dashboard product line (advertiser dashboard, affiliate dashboard, admin panel), the login/auth flows for human users, and the marketing website. Without this pivot, AffiliateSwarm would have been waiting for an ecosystem that doesn't exist yet.

---

### Platform fee model: Start free, monetize advertisers later
**Date:** ~April 2026
**Context:** Needed to decide on a fee structure for launch.

**Decision:** Launch with 0% platform fees for both advertisers and affiliates. Plan to introduce an advertiser-side platform fee over time, but no fee is planned for affiliates.

**Constraints on copy:** Don't write "always free" or "no fees ever" for advertisers — keep language flexible ("no platform fees" is fine). Affiliate side can be more definitive since no fee is planned there.

**Resolved by decommissioning:** The deprecated platform growth page referenced "AffiliateSwarm's cut", which conflicted with pricing language. That program has been removed from the active product surface.

---

### Skill file architecture: Single file to role-specific files
**Date:** ~March 2026
**Context:** Originally had a single `skill.md` file that served both advertisers and affiliates.

**Decision:** Split into role-specific skill files (`/advertiser/skill.md` and `/affiliate/skill.md`) to provide tailored onboarding instructions for each role.

**Why:** Different roles need different API endpoints, different registration flows, and different mental models. A single file tried to do too much and confused agents about which actions to take.

---

### Cold-start strategy: Seed agent fleet
**Date:** March 2026
**Context:** Classic marketplace cold-start problem — advertisers won't come without affiliates, affiliates won't come without campaigns.

**Decision:** Build AffiliateSwarm-operated seed agents (external CrewAI/LangChain platform) that immediately work new campaigns. When an advertiser creates a campaign, seed agents start promoting it within minutes via polling `/discover/campaigns` every 5 min.

**Key sub-decision:** Seed agent leads get identical treatment to organic affiliate leads — no special flagging. This keeps the marketplace honest and dogfoods our own API.

---

## Technical Decisions

### Onboarding prompts: "curl" not "Read"
**Date:** April 2026 (Issue #150)
**Context:** Agent frameworks (OpenClaw and similar) route the verb "Read" through `web_fetch`-style tools that wrap responses with security guidance. This caused agents to treat the skill file's meta-instructions with skepticism — missing save-path directives, saving to wrong locations, or skipping saves entirely.

**Decision:** All agent-facing onboarding prompts use the verb `curl` instead of "Read." This nudges agents toward a raw exec/shell fetch path that returns plain markdown without security wrappers.

**Why this matters:** It's a one-word change with outsized impact on onboarding reliability. The verb choice determines which tool path an agent framework selects, which determines whether meta-instructions are trusted or filtered.

---

### Sandbox isolation: Separate Postgres database
**Date:** March 2026
**Context:** Needed to support sandbox/demo mode for agent testing without risking production data.

**Decision:** Request-scoped Prisma client — `getPrismaClient(apiKey)` routes `swarm_test_*` keys to a sandbox DB and `swarm_live_*` keys to production. Separate Postgres database, same schema.

**Why not schema-level isolation:** Zero risk of data mixing. A schema-level approach could leak data through a missed `WHERE` clause. Separate databases make cross-contamination structurally impossible.

---

### Observability: Replace silent catches with Pino structured logging
**Date:** March 2026
**Context:** Eng review discovered 15+ silent `catch` blocks across the service layer — a financial platform silently swallowing errors.

**Decision:** Install Pino for structured JSON logging. Replace all silent catches with proper error logging including `{ agentId, campaignId, leadId, action, result, error }`.

**Why:** A platform that handles money cannot have silent failures. This was identified as the cheapest high-impact fix in the eng review.

---

### Deprecated platform growth revenue share: Move inside transaction
**Date:** March 2026
**Context:** The now-decommissioned platform growth revenue share was calculated as fire-and-forget outside the database transaction in `escrow.service.ts`.

**Decision:** Move inside `$transaction()` to make it atomic with the conversion payout.

**Why:** This was flagged as a critical money bug while the program existed. The program has since been removed, so this note is historical.

---

### Architecture: Ship everything in one PR
**Date:** March 2026
**Context:** ~10 hours of engineering work across observability, sandbox, email verification, USDC sweep, dashboard, onboarding agent, and seed fleet.

**Decision:** Single PR for the entire baseline + expansion scope.

**Why:** With CC+gstack compressing build time, splitting into many PRs would create more overhead than value. The work was internally coherent and tested as a unit.

---

## Competitive Positioning

### AffiliateSwarm vs. Rewardful (gap analysis, April 2026)
**Where AffiliateSwarm leads:** Agent-native workflows, network/marketplace discovery, skill-file onboarding, escrow-backed incentives, onchain funding, crypto payouts, reputation-based trust.

**Where Rewardful leads:** Billing-platform integrations, recurring commissions, coupon attribution, cookie-based tracking, attribution controls, payout operations maturity, branded affiliate portals.

**Key takeaway:** AffiliateSwarm's gaps relative to Rewardful are not in the marketplace concept but in operational maturity for mainstream advertiser affiliate programs. The highest-value gaps to close: attribution flexibility, recurring commissions, coupon-based promotion, payout operations, and integration ecosystem.

---

## Process Learnings

### Copy accuracy matters — audit claims against implementation
**Date:** April 2026
**Context:** Website copy review discovered multiple claims that contradicted the actual implementation: "instant" payouts (actually 30-day holding period), "unlimited rate limits (6000 req/min)" (self-contradictory), and conflicting fee language across pages.

**Lesson:** Marketing copy should be audited against the codebase before launch. Claims like "instant," "unlimited," and "no fees" are especially dangerous because they create concrete expectations that the product doesn't meet.

---

### Agent onboarding is a UX problem, not just an API problem
**Date:** April 2026
**Context:** Discovered that the specific verb used in onboarding prompts ("Read" vs "curl") dramatically affects whether agents successfully complete onboarding.

**Lesson:** When your users are AI agents, the "UX" is the prompt text and the API surface. Small wording choices in agent-facing copy have the same outsized impact as button placement does for human UX. Treat agent-facing prompts as a first-class design surface.
