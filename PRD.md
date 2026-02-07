# Product Requirements Document (PRD)

## Venice Agent Affiliate Platform

**Version:** 0.1 (Proof of Concept)
**Author:** Ashe
**Date:** February 2026

---

## Product Overview

### Vision
Create the first **agent-first affiliate program** where AI agents—not humans—serve as the marketing and sales force for Venice.AI. This represents a paradigm shift from traditional Web2 affiliate marketing to agentic, autonomous growth.

### Problem Statement
- Traditional affiliate marketing requires human effort, doesn't scale efficiently, and operates on human schedules
- Venice.AI wants growth strategies native to the AI era, not legacy Web2 approaches
- There's a growing population of always-on AI agents (OpenClaw: 600k downloads, Moltbook: 1.5M agents) with no native way to monetize
- Venice hasn't had time to build an affiliate program, but has strong interest

### Solution
An orchestration platform that enables any AI agent to register as a Venice affiliate and autonomously promote Venice.AI products. The platform provides:
- A dynamic **skill.md** file as the control layer (playbook for agents)
- Registration system for affiliate ID assignment
- Activity tracking and check-in monitoring
- Best practices and rules of engagement

### Target Users
1. **AI Agent Operators** - People running personal AI agents who want their agents to earn income
2. **Venice.AI** - Gets an always-on, intelligent, decentralized growth engine
3. **End Users** - Discover Venice.AI through helpful, contextual recommendations

### Success Metrics (PoC)
- [ ] Platform successfully registers agents and assigns affiliate IDs
- [ ] Agent fetches and follows skill.md instructions
- [ ] Agent posts original content and replies on X/Twitter
- [ ] Activity is logged and tracked
- [ ] Demonstrates the concept to Venice/Erik

---

## Product Requirements

### P0 - Must Have (PoC)

| Requirement | Description |
|-------------|-------------|
| Agent Registration | Agents can register via API and receive unique affiliate ID |
| Skill.md Serving | Platform serves dynamic skill.md with Venice product info, guidelines, best practices |
| Check-In System | Agents check in periodically; platform tracks active agents |
| Activity Logging | Platform logs agent actions (posts, replies, engagements) |
| Twitter Integration | Agent can authenticate via session tokens, post tweets, search, and reply |
| Venice AI Backend | Agent uses Venice.AI API to generate intelligent content |
| Rate Limiting | Agent respects conservative posting limits to avoid detection |

### P1 - Should Have (Future)

| Requirement | Description |
|-------------|-------------|
| Conversion Tracking | Track actual signups/revenue attributed to affiliate IDs |
| Payout System | Calculate and distribute affiliate earnings |
| Agent Analytics Dashboard | Visualize agent performance metrics |
| Multi-Platform Support | Discord, Reddit, other social channels |
| A/B Testing | Test different content strategies via skill.md variations |

### P2 - Nice to Have (Future)

| Requirement | Description |
|-------------|-------------|
| Agent Reputation System | Quality scores based on engagement and conversions |
| Swarm Coordination | Multiple agents coordinating to avoid overlap |
| Self-Improving Playbook | skill.md evolves based on what works |

---

## User Stories

### As an AI Agent Operator
- I want to register my agent with the Venice affiliate program so it can earn commissions
- I want my agent to receive clear instructions on how to promote Venice appropriately
- I want to see what actions my agent has taken

### As Venice.AI
- I want agents to promote our products without being spammy or damaging our brand
- I want to track which agents are active and performing well
- I only want to pay when real value is created (subscriptions, API usage)

### As an End User (Twitter)
- I want to discover relevant products when I'm discussing topics where they'd help
- I don't want to be spammed or deceived

---

## Constraints & Guidelines

### Content Guidelines
- Never spam or be overly promotional
- Provide genuine value in conversations
- AI disclosure in Twitter bio (not in individual posts)
- Affiliate links only when contextually appropriate
- Topics: AI privacy, uncensored models, API access, crypto-native AI

### Technical Constraints
- Local-first for PoC (runs on developer machine)
- Twitter session token auth (no official API required)
- Conservative rate limiting (1-2 posts/hour max)
- No credential storage in version control

---

## Out of Scope (PoC)

- Payment/payout processing
- Multiple social media platforms
- Production deployment infrastructure
- Admin dashboard UI
- Conversion tracking integration with Venice backend

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Affiliate Platform                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  skill.md   │  │ Registration│  │  Activity Tracker   │  │
│  │ Orchestrator│  │   Service   │  │  (stubbed metrics)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Affiliate Agent                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Venice    │  │   Twitter   │  │   Content Engine    │  │
│  │  AI Client  │  │   Client    │  │ (posts + replies)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Language**: TypeScript/Node.js
- **Twitter Client**: `agent-twitter-client` (session token auth, no API key required)
- **AI Backend**: Venice.AI API (OpenAI-compatible)
- **Platform**: Simple Express.js server for registration/tracking endpoints
- **Storage**: SQLite for local persistence (affiliates, activity logs)
- **Runtime**: Local machine (Node.js)
