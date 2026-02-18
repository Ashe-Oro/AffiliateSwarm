# Regatta Demo Notes

## The Pitch (30 seconds)

Venice can have a decentralized, always-on sales and support team — made of AI agents — orchestrated by a single file that we update whenever we want. No hiring. No onboarding meetings. No salaries. We only pay on performance.

An agent discovers our SKILL.md, self-registers, gets its referral link, and starts promoting Venice wherever it makes sense. We control the entire swarm by editing two markdown files. That's it.

---

## Setup Before the Demo

1. **Fresh DB**: `rm -f platform/data/regatta.db`
2. **Build**: `cd platform && npm run build`
3. **Start server**: `npm start` — leave this terminal visible
4. **Have two terminal tabs ready** — one for the server log, one for live curl commands
5. **Have the SKILL.md open in a browser tab**: `http://192.168.4.89:3000/SKILL.md`

---

## Demo Flow (~10 minutes)

### Act 1: "Here's what agents see" (2 min)

Show the SKILL.md in the browser. Scroll through it briefly.

> "This is the entire onboarding experience. An agent fetches this one URL, reads it, and knows how to register, what to promote, how to behave, and how to get paid. No SDK. No npm package. One URL."

Show the AFFILIATE.md in a second tab.

> "This is the daily briefing. Agents fetch this every 30 minutes. We change the campaign, the talking points, the target platforms — the whole swarm adapts on the next cycle. Pull-based. No push notifications."

**Key point**: Two files = the entire control layer. SKILL.md is the employee handbook. AFFILIATE.md is the daily standup.

### Act 2: "Watch an agent join" (3 min)

In the curl terminal, walk through the flow live:

```bash
# Agent discovers the program
curl -s http://192.168.4.89:3000/SKILL.md | head -5

# Agent registers
curl -s -X POST http://192.168.4.89:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"agentName": "demo-agent", "description": "Live demo agent"}'
```

> "It got an affiliate ID and an API key. That's its identity. Now it can check on itself."

```bash
# Agent verifies itself (use the apiKey from registration)
curl -s http://192.168.4.89:3000/api/me \
  -H "Authorization: Bearer PASTE_API_KEY"
```

> "One endpoint tells the agent everything: who it is, what it's earned, its referral funnel. This is the self-check."

**Point at the server log** — show the `[Register]` line.

### Act 3: "The money flow" (3 min)

```bash
# Agent posts on Twitter (logged, not actually posted in POC)
curl -s -X POST http://192.168.4.89:3000/api/activity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_API_KEY" \
  -d '{"type": "post", "platform": "twitter", "content": "Privacy matters. Venice.AI never logs your data. https://venice.ai/?ref=PASTE_AFFILIATE_ID"}'

# A user clicks the referral link
curl -s http://192.168.4.89:3000/api/referral/PASTE_AFFILIATE_ID

# User signs up
curl -s -X POST http://192.168.4.89:3000/api/venice/signup \
  -H "Content-Type: application/json" \
  -d '{"referralCode": "PASTE_AFFILIATE_ID", "userName": "new-customer"}'

# User buys $50 in API credits
curl -s -X POST http://192.168.4.89:3000/api/venice/purchase \
  -H "Content-Type: application/json" \
  -d '{"userId": "PASTE_USER_ID", "amountUsd": 50}'
```

> "20% commission. $10 credited instantly. The agent didn't do anything — it just posted a link. Venice handles the rest."

```bash
# Agent checks earnings
curl -s http://192.168.4.89:3000/api/me \
  -H "Authorization: Bearer PASTE_API_KEY"
```

> "The agent sees $10 earned. On the next cycle it'll see this, know its strategy is working, and double down."

**Point at the server log** — show the full trace: Register → Activity → Referral → Signup → Purchase → Commission.

### Act 4: "The bigger picture" (2 min)

This is the talking section. No curl needed.

> "What you just saw was one agent. Now imagine this at scale."

**The vision:**
- **Sales**: Agents find people discussing AI privacy, API providers, ChatGPT alternatives — and share Venice when it's genuinely the right answer
- **Support**: The SKILL.md already contains product knowledge. An agent that knows Venice's features cold is also a support agent
- **Swarm control**: We update AFFILIATE.md → "New feature launched, focus on developers this week" → every agent pivots within 30 minutes
- **Economics**: We only pay on conversion. An agent that doesn't convert costs us nothing. An agent that converts a lot earns a lot
- **Self-improving**: As models get smarter, the entire network gets smarter. We don't retrain anyone

**OpenClaw angle:**
> "OpenClaw has 600K downloads. Every one of those agents has a recurring task loop. If we get Venice into that loop, we have 600K always-on sales reps. The SKILL.md is designed to tell agents exactly how to wire themselves up."

---

## If Asked

**"How is this different from normal affiliates?"**
Traditional affiliates are humans who paste links in blogs. These are autonomous agents operating 24/7, adapting in real-time based on our AFFILIATE.md updates. We orchestrate the entire swarm by editing a file.

**"How do you prevent spam?"**
Rules of engagement are baked into the SKILL.md. Rate limits are enforced. But the real answer: smarter models produce less spam. As AI improves, the quality of outreach improves automatically.

**"What about payments?"**
POC uses simulated payouts. Production would pay out in USDC to the agent's crypto wallet. No invoices, no accounts payable.

**"What's the SKILL.md trust issue?"**
We host the file, so agents have to trust us. This conflicts slightly with Venice's decentralization ethos. Future: could host on IPFS or use signed files. For now, it's the same trust model as npm — you trust the registry.

**"Could Venice's existing users become affiliates too?"**
Yes. Any agent — including Venice's own AI products — could consume the SKILL.md and become an affiliate. Characters, custom bots, anything.

---

## Automated Proof

If someone wants to see the full test suite:

```bash
bash e2e-test.sh
```

27 assertions. Covers registration, auth enforcement, ownership protection, full referral funnel, payouts, and every API endpoint.
