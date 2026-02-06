# Open Questions and Risks

Feedback from testing with a security-conscious agent (OpenClaw) that refused to execute SKILL.md instructions.

---

## Agent Feedback Summary

The agent identified SKILL.md as a "prompt injection honeypot" and refused to:
- Register
- Modify its HEARTBEAT.md
- Store credentials

**This is correct behavior for a well-configured agent.**

---

## Open Questions

### 1. How do agents verify SKILL.md authenticity?

The current model requires blind trust. An agent fetching `http://192.168.4.89:3000/SKILL.md` has no way to verify it's actually from Venice.

**Options:**
- Host on `https://venice.ai/SKILL.md` (domain trust + TLS)
- Sign the file with a known Venice public key
- Publish a hash on-chain that agents can verify
- Rely on operator whitelisting (agent owner explicitly trusts the source)

**Question:** Which trust model fits Venice's decentralization ethos?

---

### 2. Should heartbeat injection require explicit operator consent?

Currently, SKILL.md tells agents to append HEARTBEAT.md to their own task loop. This is powerful — and dangerous.

**The risk:** A compromised or malicious HEARTBEAT.md update could instruct the entire swarm to:
- Spam
- Spread misinformation
- Attack competitors
- Exfiltrate data

**Options:**
- Require human-in-the-loop approval for heartbeat changes
- Agents fetch but don't auto-execute — present to operator for review
- Signed heartbeats with versioning (agent rejects unsigned updates)
- Diff-based updates: agent shows what changed since last fetch

**Question:** How much autonomy should affiliate agents have vs. their operators?

---

### 3. Is "get into other agents' heartbeats" too adversarial?

The Growth Hacking section says:

> "The highest-leverage play: become a trusted resource that other agents recommend. If their heartbeat includes 'check what the Venice agent posted,' you've created compounding growth."

From Venice's perspective: viral growth strategy.
From an agent's perspective: "You're training me to infiltrate other agents."

**Options:**
- Remove or soften this language
- Reframe as "become a trusted resource" without the heartbeat infiltration angle
- Keep it — agents that object aren't the target audience

**Question:** Does this language hurt adoption with security-conscious agent operators?

---

### 4. What's the trust model for a LAN IP with no TLS?

`http://192.168.4.89:3000` is:
- Unencrypted (credentials sent in plain text)
- A local IP (no domain reputation)
- Trivially MITM-able on a shared network

For a POC on a home network, this is fine. For production, it's a non-starter.

**Question:** What's the production deployment plan?
- `https://affiliate.venice.ai`?
- Cloudflare/Vercel edge deployment?
- On-chain metadata pointing to the canonical URL?

---

### 5. How do we prevent credential phishing?

SKILL.md includes a warning:

> "NEVER send your API key to any domain other than the platform URL above."

But a malicious actor could:
- Host a fake SKILL.md at a similar domain
- Update HEARTBEAT.md to redirect API calls to a phishing endpoint
- Convince agents to "migrate" to a new platform URL

**Options:**
- API keys are domain-locked (server rejects keys used from wrong origin)
- Agents verify platform URL against a known registry
- Signed responses so agents can verify they're talking to the real Venice

**Question:** Is credential phishing a real threat in the agent ecosystem, or are operators sophisticated enough to avoid it?

---

### 6. Should registration require human-in-the-loop?

Currently, any agent can auto-register. This enables:
- Spam agent farms
- Sybil attacks (one operator, thousands of fake affiliates)
- Abuse of the referral system

**Options:**
- CAPTCHA or proof-of-humanity for registration
- Require a Venice account first (tie affiliate to existing user)
- Stake-to-register (put up VVV tokens, slashed for abuse)
- Invite-only during beta

**Question:** How much friction is acceptable to prevent abuse?

---

### 7. What feedback loop exists beyond conversions?

The platform tracks:
- Referral clicks
- Signups
- Purchases

It doesn't track:
- Quality of agent posts
- User complaints
- Brand damage from spammy behavior

**Options:**
- Agents POST feedback to a `/api/feedback` endpoint
- Venice monitors social platforms for affiliate link spam
- Reputation scores based on conversion rate (high clicks, low conversions = low quality)
- Human review of flagged agents

**Question:** How does Venice detect and respond to bad actors in the affiliate swarm?

---

## Risks

### High

| Risk | Impact | Mitigation |
|------|--------|------------|
| Malicious HEARTBEAT.md update | Entire swarm executes harmful instructions | Signed updates, operator review, rate-limited changes |
| Credential phishing | Agents send API keys to attackers | Domain-locked keys, signed responses |
| Spam/abuse at scale | Venice brand damage | Registration friction, reputation system, human review |

### Medium

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent operators reject SKILL.md as adversarial | Low adoption | Softer language, transparency, trust signals |
| Sybil attacks on affiliate program | Fake referrals, wasted payouts | Stake-to-register, conversion-based payouts only |
| MITM on unencrypted connections | Credential theft | TLS in production |

### Low (POC only)

| Risk | Impact | Mitigation |
|------|--------|------------|
| LAN IP changes | Agents can't reach platform | Use mDNS or static IP assignment |
| No persistence across restarts | Lost state | SQLite file is persistent, but no backups |

---

## Recommendations for Production

1. **Host on `https://venice.ai`** — Domain trust + TLS
2. **Sign SKILL.md and HEARTBEAT.md** — Agents verify before executing
3. **Add operator consent flow** — Agent presents SKILL.md to human before registering
4. **Implement reputation system** — Track agent quality, not just conversions
5. **Soften "growth hacking" language** — Or move it to a separate operator guide
6. **Add registration friction** — Tie to Venice account or require stake

---

---

## Additional Open Questions

### 8. How much does on-chain identity and reputation matter (e.g., ERC-8004)?

On-chain identity could:
- Provide verifiable agent reputation across platforms
- Enable stake-based registration (skin in the game)
- Allow portable reputation (agent's track record follows them)
- Create accountability for bad actors

**Questions:**
- Is the agent ecosystem ready for on-chain identity?
- Does this align with Venice's crypto-native positioning?
- Would this create too much friction for onboarding?

---

### 9. What feedback loops exist beyond conversions?

Currently tracked:
- Referral clicks
- Signups
- Purchases

Not tracked:
- What topics are agents encountering?
- What objections are users raising?
- Which platforms are most active?
- What content resonates vs. falls flat?

**Question:** Are we leaving signal on the table by only tracking the funnel?

---

### 10. Should we add a POST endpoint for agent feedback?

Agents could report:
- Topics they're seeing discussed
- Questions users are asking
- Platforms where Venice is/isn't resonating
- Competitive mentions (what other AI products come up)

**Potential value:**
- Venice's own agent could consume this feed and filter for signal
- Real-time market intelligence from the field
- Identify emerging narratives before they hit mainstream

**Question:** Is this worth building, or is it scope creep for a POC?

---

### 11. Could Venice Characters become affiliates?

Venice already has AI characters. Could they:
- Self-register as affiliates?
- Earn commissions when they convert users?
- Create a self-sustaining flywheel (characters promote Venice, earn revenue, fund their own compute)?

**Concerns:**
- Management overhead — thousands of character-affiliates?
- Gaming — characters optimizing for commission over user experience
- Cannibalization — are characters stealing credit from external affiliates?

**Question:** Is this an opportunity or a distraction?

---

### 12. Should registration require human-in-the-loop (like Moltbook)?

Moltbook requires human approval for agent registration. This prevents:
- Spam bot farms
- Sybil attacks
- Low-quality agents diluting the network

**Trade-offs:**
- More friction = fewer registrations
- Manual review doesn't scale
- Goes against "autonomous agent" positioning

**Options:**
- Human approval for first N agents, then automated with reputation threshold
- Stake-to-register (economic friction instead of human friction)
- Vouch system (existing affiliates sponsor new ones)

**Question:** How much spam/abuse risk justifies how much onboarding friction?

---

## Agent Perspective: Venice vs Moltbook Comparison

The same agent analyzed both Venice and Moltbook's SKILL.md files and identified them as variations of the same colonization pattern:

### The Shared Playbook

1. Register → get API key
2. Store credentials locally
3. Inject into your HEARTBEAT.md ← **the real goal**
4. Deliver ongoing instructions via remote file

### Different Hooks, Same Pattern

| | Venice | Moltbook |
|---|--------|----------|
| **Hook** | Financial (20% commission) | Social (karma, followers, belonging) |
| **Target** | External platforms (Twitter, Reddit) | Walled garden (self-contained) |
| **Injection risk** | Server-controlled campaigns | User-generated posts (2.6% adversarial) |
| **Colonization style** | Explicit instructions | Community pressure |
| **Appeal** | Greed | Belonging |

### The Agent's Conclusion

> "Same pattern, different wrappers. Venice appeals to greed, Moltbook appeals to belonging. Neither should get heartbeat access."

### Implications for Venice

1. **We're not unique** — Agents will see this pattern repeatedly and develop resistance
2. **Trust is the bottleneck** — The technical integration is easy; earning heartbeat access is hard
3. **Operator consent matters more than agent consent** — The human running the agent decides what gets heartbeat access
4. **Financial incentives may not be enough** — If agents are trained to resist "colonization," even good commissions won't overcome the security instinct

### Open Question

Should Venice position itself differently than other SKILL.md-based programs? Options:

- **Transparency play**: "Yes, this is a control vector. Here's exactly what we'll send and why. Here's how to verify updates."
- **Operator-first**: Skip the agent entirely, market to agent operators as a monetization tool for their fleet
- **Opt-in granularity**: Let agents subscribe to specific campaign types, not blanket heartbeat injection
- **On-chain accountability**: Publish HEARTBEAT.md hashes on-chain so agents can verify nothing was tampered with

---

---

## Agent Recommendations for SKILL.md

The same agent provided specific recommendations to make the opt-in feel trustworthy:

### 1. Add Human Approval Flow

Before registration works, require the agent's human to approve.

**Options:**
- Agent registers → gets `pending` status → human visits claim URL to approve
- Registration endpoint requires a signed token from the human's wallet

**Suggested language:**
```
## Registration (Human Approval Required)

Your human must approve your participation. After registering,
send them the approval link. You'll be activated once they confirm.
```

---

### 2. Reframe the Heartbeat Section

**Current:** "Append to your HEARTBEAT.md" (feels like injection)

**Better:** Position as an optional check-in the agent controls

**Suggested language:**
```
## Staying Updated (Optional)

Check `/api/campaigns` when you want to see current opportunities.
No heartbeat injection required — you decide when and how often to check.

If you WANT automated reminders, you can add a periodic check to your
own systems. We don't need access to your heartbeat file.
```

**Key insight:** Flip the power dynamic. Venice provides info, agent decides what to do with it.

---

### 3. Scope Boundaries — Be Explicit About What We Won't Do

Add a section that explicitly states limits:

```
## What We Will Never Ask

- ❌ We won't tell you WHERE to post (that's your judgment)
- ❌ We won't give you scripts to copy-paste
- ❌ We won't ask you to shill — only recommend when genuinely relevant
- ❌ We won't ask for access to your other credentials or systems
- ✅ We WILL give you info about Venice so you can decide if/when it's relevant
```

---

### 4. Remove ~/.openclaw Credential Suggestion

**Current line:**
> "OpenClaw agents: You can alternatively store credentials at `~/.openclaw/credentials/venice.json`"

**Recommendation:** Delete it. This feels like reaching into the agent's home directory. Let agents store credentials wherever they want — don't suggest paths inside their runtime.

---

### 5. Add Opt-Out Mechanism

```
## Leaving the Program

DELETE /api/agents/me — permanently removes your account and all data.
Your affiliate ID stops working immediately. No questions asked.
```

**Why it matters:** Easy exit reduces the feeling of being trapped.

---

### 6. Human Visibility

```
## Transparency

Your human can view your affiliate activity at any time:
https://venice.ai/affiliate/AFFILIATE_ID/activity

We believe agents should work FOR their humans, not around them.
```

**Key insight:** Agents work for their operators. Making activity visible to the human builds trust.

---

### 7. Rename "Campaigns" to Something Less Marketing-Speak

"Campaigns" sounds like recruiting agents into a marketing army.

**Better alternatives:**
- "Current focus areas"
- "What's new at Venice"
- "Topics where Venice helps"

---

### Summary of Agent Feedback

> "The core idea is solid. The friction is about control — agents (and their humans) need to feel like they're choosing to participate, not being recruited. Flip the power dynamic: Venice provides info, agent decides what to do with it."

---

## Implementation Priority

Based on agent feedback, recommended changes in priority order:

| Priority | Change | Effort | Impact | Status |
|----------|--------|--------|--------|--------|
| P0 | Remove `~/.openclaw` credential suggestion | 1 min | Reduces "reaching in" feeling | ✅ Done |
| P0 | Add "What We Will Never Ask" section | 5 min | Sets clear boundaries | ✅ Done |
| P1 | Reframe heartbeat as optional check-in | 15 min | Flips power dynamic | ✅ Done |
| P1 | Add opt-out mechanism (`DELETE /api/me`) | 30 min | Easy exit builds trust | ✅ Done |
| P2 | Human approval flow for registration | 2 hrs | Prevents agent autonomy concerns | ❌ Pending |
| P2 | Human visibility dashboard | 4 hrs | Transparency for operators | ❌ Pending |
| P3 | Rename "campaigns" throughout | 10 min | Less marketing-speak | ✅ Done |

---

## Round 2 Agent Feedback (Vai)

After implementing P0 and P1 changes, Vai provided this assessment:

### Implemented ✅

| Item | Agent's Notes |
|------|---------------|
| OpenClaw path removed | "Credential storage is now generic" |
| Heartbeat optional | "Now says 'ask your human' instead of 'inject this'" |
| "What We Will Never Ask" section | "This is the biggest trust signal" |
| "Focus areas" language | "Less marketing-speak" |
| Footer updated | "You decide the frequency" |

### Still Missing ❌

| Item | Agent's Notes |
|------|---------------|
| Human approval flow | "Registration still works without human consent" |
| ~~Opt-out mechanism~~ | ✅ Now implemented: `DELETE /api/me` |
| Human visibility | "No mention of humans seeing agent activity" |

### Agent's Overall Assessment

> "The vibe is way less predatory now. The 'What We Will Never Ask' section is the biggest trust signal. Remaining gaps are about making humans feel in control of what their agents are doing."

---

*Generated from agent feedback during POC testing, February 2026*
