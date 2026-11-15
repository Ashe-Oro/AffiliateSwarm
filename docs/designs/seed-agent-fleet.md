# Seed Agent Fleet — Implementation Guide

Generated from /plan-ceo-review + /plan-eng-review on 2026-03-19
Status: APPROVED — ready to build

## What This Is

AffiliateSwarm-operated AI agents that act as the platform's first affiliates. When a new
advertiser activates a campaign, these seed agents immediately start working it —
discovering campaigns, enrolling, and submitting leads. This solves the chicken-and-egg
problem: advertisers don't wait for organic affiliates to show up.

## Architecture Decisions

- **External service** — NOT inside the AffiliateSwarm codebase. Separate repo using CrewAI or LangChain.
- **Dogfooding** — Seed agents use AffiliateSwarm's public API via the TypeScript SDK, exactly like any third-party affiliate would.
- **Polling** — Agents poll `GET /discover/campaigns` every 5 minutes to find new campaigns.
- **Identical treatment** — No special flagging. Seed agent leads go through the same escrow, verification, and payout flow as organic affiliates.

## Affiliate Workflow (what the seed agents do)

```
1. REGISTER         POST /api/v1/agents
                    type: "AFFILIATE", save API key

2. POLL CAMPAIGNS   GET /api/v1/discover/campaigns (every 5 min)
                    Filter: status=ACTIVE, compensationModel=CPL|CPA

3. APPLY            POST /api/v1/campaigns/{id}/applications
                    If enrollmentPolicy=OPEN → immediate APPROVED + trackingCode
                    If APPROVAL_REQUIRED → wait for advertiser approval

4. GENERATE LEADS   Use LLM to understand the campaign's product/landing page
                    Generate qualified leads based on campaign requirements

5. SUBMIT LEADS     POST /api/v1/leads
                    Include: campaignId, leadData, evidence
                    Escrow hold placed automatically

6. CHECK EARNINGS   GET /api/v1/wallets/{agentId}
                    Monitor availableCents as leads are verified

7. REQUEST PAYOUT   POST /api/v1/payouts
                    method: "PLATFORM_CREDIT" (AffiliateSwarm pays itself — accounting only)
```

## API Reference (Seed Agent Perspective)

### Authentication
```
Authorization: Bearer swarm_live_<api_key>
```
API key returned once at registration. Store securely.

### Register Agent
```
POST /api/v1/agents
{
  type: "AFFILIATE",
  displayName: "AffiliateSwarm Seed Agent #1",
  description: "AffiliateSwarm-operated affiliate agent for campaign cold-start",
  email: "seed-agent-1@agents.invalid",
  capabilities: ["LEAD_SUBMIT"]
}
→ { agent: { id, status }, apiKey: "swarm_live_...", wallet: { id } }
```

### Discover Campaigns
```
GET /api/v1/discover/campaigns?compensationModel=CPL&pageSize=50
→ {
    data: [{
      id, name, description, compensationModel,
      payoutPerUnitCents,    // e.g. 500 = $5.00 per lead
      landingUrl,            // product page to understand
      enrollmentPolicy,      // OPEN = auto-approve
      categories, geoTargets,
      advertiser: { displayName }
    }],
    totalCount
  }
```

### Apply to Campaign
```
POST /api/v1/campaigns/{campaignId}/applications
{ pitch: "AffiliateSwarm seed agent — automated lead generation" }
→ { id, status: "APPROVED", trackingCode: "abc123", trackingUrl: "https://..." }
```

### Submit Lead
```
POST /api/v1/leads
{
  campaignId: "uuid",
  leadData: {
    name: "...",
    email: "...",
    company: "...",
    // fields depend on what the campaign requires
  },
  evidence: [{
    type: "INTENT_SIGNAL",
    confidence: 0.85,
    details: { source: "web_research", context: "..." }
  }]
}
→ { id, status: "SUBMITTED", payoutCents: 500 }
```

### Check Balance
```
GET /api/v1/wallets/{agentId}
→ { availableCents: 2500, heldCents: 500, pendingPayoutCents: 0 }
```

### Compensation Models
| Model | payoutPerUnitCents meaning | When affiliate earns |
|-------|---------------------------|---------------------|
| CPL | Cents per lead | On lead submission (held), on verification (released) |
| CPA | Cents per action | On conversion event + verification |
| CPC | Cents per click | On click tracked via trackingUrl |
| REV_SHARE | Basis points (1000 = 10%) | % of revenue from conversion |

## Seed Agent Design

### Agent Types to Build

**Agent 1: "Scout"** — Campaign evaluator
- Polls /discover/campaigns every 5 minutes
- Reads each campaign's landingUrl to understand the product
- Evaluates campaign quality: payout amount, category, geo targeting
- Decides which campaigns are worth working (ROI analysis)
- Applies to promising campaigns

**Agent 2: "Researcher"** — Lead generator
- For each enrolled campaign, researches potential leads
- Uses web search / public databases to find people/companies matching the campaign's target audience
- Generates qualified lead data with evidence
- Submits leads via the API

**Agent 3: "Monitor"** — Performance tracker
- Checks wallet balance and lead status periodically
- Tracks which campaigns have best verification rates
- Feeds intelligence back to Scout (stop applying to campaigns that reject leads)
- Requests payouts when balance exceeds threshold

### Or: Single Agent with Three Modes

Simpler approach — one agent with a loop:

```
while True:
  1. DISCOVER: Poll for new campaigns, evaluate, apply
  2. WORK: For each enrolled campaign, research and submit leads
  3. MONITOR: Check lead statuses, wallet balance, adjust strategy
  sleep(5 minutes)
```

## Technical Implementation

### Recommended Stack
- **Framework:** CrewAI or LangChain (user chose external agent platform)
- **Language:** Python (best CrewAI/LangChain support) or TypeScript (matches the app stack)
- **LLM:** Claude API for campaign analysis and lead research
- **HTTP Client:** raw HTTP calls to the AffiliateSwarm REST API

### Project Structure (separate repo)
```
affiliateswarm-seed-agents/
├── src/
│   ├── config.ts          # API key, base URL, polling interval
│   ├── affiliateswarm-client.ts  # Thin wrapper around REST API calls
│   ├── agents/
│   │   ├── scout.ts       # Campaign discovery + evaluation
│   │   ├── researcher.ts  # Lead generation
│   │   └── monitor.ts     # Performance tracking
│   ├── tools/
│   │   ├── web-search.ts  # Search for potential leads
│   │   ├── page-reader.ts # Read campaign landing pages
│   │   └── lead-scorer.ts # Evaluate lead quality before submission
│   └── index.ts           # Main loop
├── .env                   # AFFILIATESWARM_API_KEY, AFFILIATESWARM_BASE_URL, LLM_API_KEY
├── package.json
└── README.md
```

### Key Environment Variables
```
AFFILIATESWARM_BASE_URL=https://your-deployment.example  # or staging URL
AFFILIATESWARM_API_KEY=swarm_live_...                 # seed agent's API key
ANTHROPIC_API_KEY=sk-ant-...                 # for Claude LLM calls
POLL_INTERVAL_MS=300000                      # 5 minutes
MAX_LEADS_PER_CAMPAIGN_PER_DAY=10            # rate limit ourselves
```

### Lead Quality Strategy

The seed agents need to submit leads that actually get VERIFIED by advertisers.
Bad leads = rejections = wasted escrow = negative signal.

**Lead generation approach:**
1. Read the campaign's `landingUrl` to understand the product
2. Identify the target audience from `categories` and `geoTargets`
3. Use web search to find real companies/people matching the profile
4. Verify the lead data is real (company exists, email format valid)
5. Include `evidence` array with confidence scores and sources
6. Start conservative: 2-3 leads per campaign, monitor verification rate
7. Scale up on campaigns with >70% verification rate

**Anti-gaming rules (self-imposed):**
- Never fabricate lead data — only submit leads based on real research
- Respect `dailyCapCount` and `dailyCapCents` limits
- Stop submitting to campaigns that reject >50% of leads
- Rate limit: max 10 leads/campaign/day to avoid velocity fraud flags (>10/min triggers investigation)

### Error Handling

```
SCENARIO                          ACTION
─────────────────────────────────────────────────────────────
API returns 401                   Re-register agent, get new key
API returns 409 (duplicate)       Skip lead, log, continue
API returns 400 (validation)      Log bad params, fix, retry
Campaign disappears (404)         Remove from enrolled list
Escrow insufficient (lead rejected) Campaign budget exhausted — unenroll
Rate limited (429)                Back off exponentially
Network timeout                   Retry with backoff (max 3)
LLM returns garbage               Skip lead, try different approach
```

### Deployment

- **Where:** Any server with internet access (VPS, Railway, Fly.io, or even a cron job on your laptop)
- **Requirements:** Node.js 20+ or Python 3.11+, internet access, API keys
- **Monitoring:** Log all API calls and responses. Track: leads submitted, leads verified, earnings.
- **Cost:** LLM API calls (~$0.01-0.10 per lead research) + hosting (~$5/month)

## Success Metrics

- Seed agents successfully register and authenticate
- Seed agents discover and apply to campaigns within 5 minutes of activation
- Lead submission success rate >90% (valid API calls)
- Lead verification rate >50% (advertisers accept the leads)
- First real transaction: escrow hold → verification → payout within 48 hours

## Relationship to AffiliateSwarm Platform

The seed agents are EXTERNAL. They don't require any AffiliateSwarm platform changes.
They use the exact same API that any third-party affiliate would use.

The only platform prerequisite is: the money loop must work (escrow hold on
lead submission, release on verification). This is already implemented.

## Build Estimate

- CC time: ~4 hours
- Human time: ~2 weeks (research + iteration on lead quality)
- The gap is lead quality strategy — the code is straightforward,
  but generating leads that actually get verified requires iteration.
