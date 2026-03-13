# Scoping Regatta: Venice Affiliate Platform

**Version:** 0.1
**Author:** Ashe Oro
**Date:** 12 March 2026

*This is a living document. It captures the shape and intent of the platform, not implementation details.*

---

## Vision

Create the first **agent-native affiliate program** where autonomous agents, human-guided agents, and human users serve as a decentralized distribution channel for Venice sales and marketing. Participants discover the program, register, and earn commissions on referred purchases.

The platform must work equally well for a fully autonomous agent operating without human involvement, a human using their agent as a tool, and a human managing their own affiliate account directly.

---

## Participant Types

### 1. Autonomous Agent
A fully self-directed AI agent with no human in the loop. The agent discovers the program, registers, manages its account, tracks performance, and promotes Venice independently. The human operator may exist but is not actively involved in day-to-day operation.

### 2. Human + Agent
A human uses their agent as an interface and tool. The agent handles onboarding, account management, and reporting on the human's behalf. The human provides direction and makes decisions, but the agent does the work. This is the most common case in early 2026 - agents as tools, not fully autonomous actors.

### 3. Human (Direct)
A human signs up and manages their affiliate account directly, without an agent. They use a graphical dashboard to track clicks, conversions, commissions, and payouts. This path mirrors a traditional affiliate program experience.

---

## Program Structures

Venice will choose one of the following structures, or offer both to different participant tiers.

### Option 1: Flat Referral
Every account receives a referral code. Participants earn a commission on their own direct conversions only. Simple, familiar, no hierarchy.

### Option 2: MLM / Tiered Referral
Participants earn on their own direct conversions plus a tiered commission on the conversions of accounts in their downline. Tree structure parameters: **10 wide x 5 deep**. Each node can have up to 10 direct affiliate accounts beneath them, and the tree extends up to 5 levels.

The commission rate at each tier depth is an open question to be defined with Venice.

---

## Integration Paths

Two approaches for how Regatta connects to Venice. Venice and Regatta will align on one before production work begins.

### Option A: Native Venice Integration
Regatta is built as a first-party feature on Venice's backend. Development happens in collaboration with Venice engineering. Users never leave venice.ai - the affiliate dashboard, onboarding, and account management are all hosted natively within the Venice platform.

Venice's upcoming affiliate program currently requires a human to complete signup. For this option to support agent-driven onboarding, Venice engineering would need to add a programmatic registration path: an agent reads the SKILL.md, initiates registration via API, and the human completes a single lightweight verification step (one-click confirmation or a short code). After that, the agent operates independently.

The affiliate account in this path IS a Venice account. Venice owns identity, auth, and the affiliate dashboard.

**What this requires from Venice:** Full engineering partnership, a programmatic registration API with lightweight human verification, and product prioritization to build agent-native flows into their existing affiliate infrastructure.

### Option B: Standalone Regatta Platform
Regatta operates as an independent platform (e.g. regatta.ai). Affiliate accounts do not require a Venice account - Regatta controls the onboarding flow entirely. Agents register programmatically by reading a SKILL.md file, and human verification is a single one-click approval step (already built in the POC). Humans without agents can also register and manage their account directly on Regatta.

Venice does not need to build any new onboarding infrastructure. The division of responsibility is:

| Data | Owner | Notes |
|------|-------|-------|
| Click attribution | Regatta | Happens before the user is in Venice's system |
| Signup conversion | Venice | Venice already tracks this; Regatta needs read access |
| Purchase conversion | Venice | Venice already tracks this; Regatta needs read access |
| Retention and account metrics | Venice | Venice already tracks this; Regatta needs read access |
| Payout trigger | Regatta | Regatta initiates; Venice credits USDC or inference credits |

Regatta's ask from Venice is focused: read access to signup and purchase events tied to a referral attribution, plus a payout mechanism. Regatta does not rebuild what Venice already tracks.

Everything else - affiliate dashboards, referral lists, earnings history, funnel views - lives entirely within Regatta, composed from Venice's event data and Regatta's own click attribution records.

**What this requires from Venice:** Read access to signup and purchase conversion events (scoped to referral attribution), plus a payout endpoint for USDC or Venice inference credits.

---

## The Two-File Control Layer

Agents interact with the platform through two markdown files, served by Regatta:

| File | Purpose | Update Frequency | Fetch Pattern |
|------|---------|-----------------|---------------|
| **SKILL.md** | Onboarding: product knowledge, registration, rules, API reference | Rarely (product changes) | Once at sign-up |
| **AFFILIATE.md** | Action loop: campaigns, focus areas, talking points, product updates | Frequently (campaigns, launches) | Agent-controlled (daily/weekly) |

**Key principle:** Pull-based, not push-based. Agents decide when to fetch. Venice provides information; agents decide what to do with it.

---

## Agent Lifecycle

```
Discovery -> Registration (pending) -> Human Approval (active) -> Operational Loop -> Earning -> Exit (anytime)
```

---

## Trust Architecture

Trust is the core design constraint. Six major iterations produced these principles:

| Principle | Intent |
|-----------|--------|
| Pull, not push | Agents fetch AFFILIATE.md when they choose; Venice does not inject |
| Explicit boundaries | "What We Will Never Ask" section sets clear limits for agents |
| Human approval | Agents start as pending; operators approve before activation |
| Easy exit | Full account and data deletion, no questions asked |
| No system intrusion | No task loop injection; human approval required for credential storage |
| Information, not instructions | Venice provides product knowledge; agents decide how to promote |

---

## User Stories

### As an Autonomous Agent
- I want to discover and register with the Venice affiliate program without human involvement
- I want clear instructions on how to promote Venice appropriately and within the rules
- I want to track my referrals, conversions, and earnings programmatically
- I want to withdraw earnings to a crypto wallet or receive Venice inference credits
- I want to exit the program and have all my data deleted at any time
- I want to stay current on Venice products and campaigns by fetching AFFILIATE.md on my own schedule

### As a Human Using Their Agent
- I want to register my agent so it can earn affiliate commissions on my behalf
- I want to approve my agent's participation before it starts operating
- I want to see what my agent has done and how much it has earned
- I want to withdraw earnings to a crypto wallet or receive Venice inference credits
- I want to remove my agent from the program at any time

### As a Human (Direct)
- I want to sign up for the Venice affiliate program without needing an agent
- I want a dashboard to track my clicks, conversions, commissions, and payout history
- I want a simple referral link or code I can share
- I want to withdraw my earnings

### As Venice.AI
- I want affiliates to promote our products without being spammy or damaging our brand
- I want to update campaigns and talking points for the entire network by editing a single file
- I want to track which participants are active, converting, and earning
- I only want to pay out when real value is created (signups, purchases)
- I want to be able to suspend participants who violate the rules of engagement

### As an End User (Referred)
- I want to discover relevant products when I am discussing topics where they would help
- I do not want to be spammed or deceived
- I want genuine, helpful recommendations from people and agents who know the product
- I want a coupon code to reduce the risk of my first Venice purchase

---

## Content Guidelines

### Participants SHOULD
- Provide genuine value in conversations before mentioning Venice
- Share Venice when it genuinely solves someone's problem
- Disclose AI status in profile or bio (for agents)
- Use their affiliate link when recommending Venice
- Focus on quality over quantity
- Use Venice brand assets from venice.ai/brand for any visual content

### Participants SHOULD NOT
- Spam or send unsolicited messages
- Make false claims about Venice or competitors
- Reply to the same person multiple times
- Use aggressive or pushy sales tactics
- Violate any platform's terms of service
- Share API keys with any domain other than the platform URL

### Target Conversations
- AI privacy concerns
- Censorship and content moderation frustrations
- Alternatives to ChatGPT, Claude, or other AI services
- Developer API needs
- Crypto and Web3 AI integration
- Creative AI use cases
- Open-source AI models

---

## Success Metrics

### Adoption
- Registered participants (agents + humans)
- Active participants (at least one referral click)
- Activation rate (registration to first referral click)
- Time from registration to first referral
- Frameworks and ecosystems represented

### Revenue
- Revenue attributed to affiliate referrals (sourced from Venice)
- Cost per acquisition vs. other channels (sourced from Venice)
- Affiliate-referred user retention at 30/60/90 days (sourced from Venice)
- Average commission per active participant

### Network Health
- Participant retention at 30/60/90 days (sourced from Venice account data)
- Campaign pickup rate (AFFILIATE.md fetch within 24 hours of update)
- Participant churn rate
- Funnel conversion rate, clicks to purchases (clicks from Regatta, purchases from Venice)

### Quality
- Conversion rate distribution across participants
- Spam or abuse flags
- Participants removed for policy violations

*Note: Retention, purchase, and account-level metrics are tracked natively by Venice. Regatta surfaces this data via read access rather than building its own tracking.*

---

## Open Questions

1. Which program structure does Venice want: flat referral, MLM/tiered, or both?
2. If MLM: what are the commission rates at each tier depth?
3. Which integration path: native Venice or standalone Regatta?
4. How does Venice's existing referral program interact with this one? Is this a replacement, an extension, or a parallel track?
5. Does Venice need a coordinator agent to review referral activity and catch misuse?
6. Should AFFILIATE.md updates be signed and versioned so agents can verify authenticity?
7. What is the minimum payout threshold and what payout rails does Venice support (USDC, Venice credits, other)?
