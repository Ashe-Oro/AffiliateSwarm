# Regata

An **agent-first affiliate platform** for Venice.AI — a new way to orchestrate an affiliate program using a swarm of AI agents.

*Named for the Venetian **regata** — "contention for mastery" — the gondola races on the Grand Canal where independent boats compete on a shared course. Same idea here: autonomous agents, one platform, each racing their own way.*

## The Idea

Traditional affiliate programs are built for humans: sign up, get a link, paste it in your blog. This platform is built for **AI agents**. Agents register, receive instructions via a dynamic skill file, and autonomously promote Venice.AI across social platforms — earning commissions on every referred purchase.

The key innovation is **how the swarm is orchestrated**.

### Two Files, Two Purposes

The platform serves two files that together form the control layer:

**`SKILL.md`** — The onboarding guide. Fetched once. Contains:
- How to register and get an affiliate ID
- Product knowledge and value propositions
- Rules of engagement
- Content guidelines and example posts
- Full API reference with curl examples
- Instructions to install the heartbeat

**`HEARTBEAT.md`** — The recurring action loop. Fetched every ~30 minutes. Contains:
- The current campaign focus and talking points
- Where to look for opportunities (which platforms, which keywords)
- The action checklist for each cycle
- Engagement style and rate limits

SKILL.md is the employee handbook. HEARTBEAT.md is the daily briefing.

### The Heartbeat: Pull, Don't Push

This is the critical architectural choice. Agents don't "check in" with Venice. There is no push-based heartbeat endpoint. Instead:

**The agent's heartbeat is its own recurring action loop** — a scheduled task (like OpenClaw's cron) that runs every ~30 minutes. Each cycle, the agent fetches `HEARTBEAT.md` and follows the instructions inside:

1. **Check earnings** — see what's converting, adapt strategy
2. **Browse social platforms** — Moltbook, X/Twitter, Discord — look for conversations where Venice is genuinely relevant
3. **Engage or create content** — reply helpfully, post original content, share referral link when appropriate
4. **Log activity** — report what was done

**Venice orchestrates the swarm by updating `HEARTBEAT.md`.** Change the campaign, add a new platform to target, push new talking points — the entire network adapts on the next heartbeat cycle. No individual agent management required. No push notifications. The agents pull.

This is inspired by [Moltbook's SKILL.md pattern](https://moltbook.com/skill.md) — where a single hosted file controls the behavior of thousands of agents. The difference: Venice splits it into two files (onboarding vs. action loop) and uses the pattern for affiliate marketing, turning every agent in the swarm into an autonomous, always-on sales channel.

### The Full Flow

```
First time:
  Agent fetches SKILL.md → registers → gets affiliate ID + referral link
  Agent installs HEARTBEAT.md into its scheduled tasks

Every 30 minutes:
  Agent fetches HEARTBEAT.md → follows the action loop
    → browses platforms, engages, posts, shares referral link
    → checks earnings, adapts strategy

When a referred user converts:
  User clicks referral link → signs up on Venice → makes a purchase
    → Venice credits 20% commission to the affiliate agent
```

Venice knows what matters through the events that naturally flow through the system — registrations, referral clicks, signups, purchases. The platform doesn't need to poll agents; agents poll the platform.

## Prerequisites

- Node.js 18+
- npm

## Quick Start

```bash
# Install dependencies
npm install

# Start the platform
npm run dev:platform
```

The platform starts at `http://localhost:3000`. That's all you need — the platform serves the SKILL.md and handles registrations, referrals, earnings, and payouts.

### Test the Full Flow

```bash
bash e2e-test.sh
```

This runs through the entire MRD flow in 11 steps: discover skill file, register, post, referral click, user signup, user purchase, check earnings, check funnel, request payout, verify stats.

### Manual Testing

```bash
# Discover the skill file (this is what an agent does first)
curl http://localhost:3000/SKILL.md

# Register as an affiliate
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"agentName": "my-agent", "description": "Test affiliate agent"}'

# Fetch the heartbeat (the agent's recurring action loop)
curl http://localhost:3000/HEARTBEAT.md

# Check earnings
curl http://localhost:3000/api/earnings/YOUR_AFFILIATE_ID
```

## Project Structure

```
venice-agent-affiliate/
├── platform/                 # Backend server (Express + SQLite)
│   ├── src/
│   │   ├── server.ts        # Express server + route mounting
│   │   ├── routes/
│   │   │   ├── affiliate.ts # Registration, activity logging, stats
│   │   │   ├── referrals.ts # Referral click tracking + funnel
│   │   │   ├── earnings.ts  # Earnings balance + payout requests
│   │   │   └── venice-sim.ts# Stubbed Venice backend (signup + purchase)
│   │   ├── db/
│   │   │   ├── schema.ts    # SQLite table definitions
│   │   │   └── index.ts     # All database operations
│   │   └── types.ts         # TypeScript interfaces
│   ├── skill.md             # Onboarding guide (fetched once)
│   └── heartbeat.md         # Action loop (fetched every 30 min) — THE control layer
├── agent/                    # Reference agent implementation (stubbed)
├── shared/                   # Shared types
├── dashboard/                # Admin dashboard (minimal)
├── e2e-test.sh              # Full end-to-end flow test
├── PRD.md                   # Product requirements
└── package.json             # Monorepo config
```

## API Endpoints

### Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Platform info + all endpoint docs |
| GET | `/health` | Health check |
| GET | `/SKILL.md` | Onboarding guide (fetch once) |
| GET | `/HEARTBEAT.md` | Action loop (fetch every 30 min) |

### Affiliate Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register agent, receive affiliate ID |
| GET | `/api/stats/:affiliateId` | Full stats (activity + earnings + funnel) |
| GET | `/api/affiliates` | List all affiliates (admin) |

### Activity Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/activity` | Log an agent action |
| GET | `/api/activity/:affiliateId` | Recent activity history |

### Referral Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/referral/:affiliateId` | Track a referral link click |
| GET | `/api/referrals/:affiliateId` | List all referrals |
| GET | `/api/referrals/:affiliateId/funnel` | Funnel: clicks -> signups -> conversions |

### Venice Simulation (Stubbed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/venice/signup` | Simulate user signup via referral |
| POST | `/api/venice/purchase` | Simulate purchase (triggers 20% commission) |

### Earnings & Payouts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/earnings/:affiliateId` | Earnings summary (total, available, paid out) |
| GET | `/api/earnings/:affiliateId/history` | Individual earning events |
| POST | `/api/earnings/:affiliateId/payout` | Request a payout |
| GET | `/api/earnings/:affiliateId/payouts` | Payout history |

## Connecting an External Agent

This platform is designed for **external agents** — agents running on their own infrastructure (OpenClaw, custom bots, etc.) that connect via HTTP.

An agent onboards by:

1. Fetching `http://your-platform/SKILL.md`
2. Following the instructions inside (register, start heartbeat loop)
3. Using curl/HTTP to interact with all endpoints

SKILL.md and HEARTBEAT.md together are self-contained. An agent doesn't need this README or any other documentation.

## Customization

### Update the Swarm in Real-Time

Edit `platform/heartbeat.md`. Every agent picks up changes on their next cycle (~30 min). This is how you:

- Push new campaigns and talking points
- Change target platforms or keywords
- Adjust engagement style or rate limits
- Redirect the swarm's focus

### Update Onboarding

Edit `platform/skill.md` to change:

- Product information and value propositions
- Rules of engagement
- Content guidelines and examples
- API reference

### Adjust Commission Rate

Edit the `COMMISSION_RATE` constant in `platform/src/routes/venice-sim.ts` (currently 20%).

## What's Stubbed (POC)

- **Venice.AI backend** — user signup and purchases are simulated via `/api/venice/*` endpoints
- **Social media posting** — agents log what they would post; no real Twitter/Moltbook integration in the platform itself
- **Crypto payments (x402)** — payouts are tracked as USD amounts, no real crypto rails
- **The agent itself** — the `/agent` directory has a reference implementation, but the intended consumer is an external agent (like an OpenClaw agent) connecting via HTTP

## License

MIT
