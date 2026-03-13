# Regatta TODO

## Human-in-the-Loop Rethink

The current approval flow needs a deeper rethink. The core problem: any instruction-based gate can be bypassed by a sufficiently capable or confused agent. We need to design an approval flow where the human's involvement is enforced by the system, not by agent instructions. Questions to resolve:
- Should approval require the human to be authenticated (login system)?
- Should the dashboard be gated at all, or is "anyone with the URL can approve" acceptable?
- What's the right UX for the human -- email notification, dashboard ping, something else?
- Should there be an audit log of who approved what and when?

---

## Code Audit Findings

### Fix Soon (minor hosted environment issues)

- **`192.168.4.89` fallback URLs** - wrong default, should be `http://localhost:3000`
  - `platform/src/server.ts:17`
  - `platform/src/routes/affiliate.ts:38`
- **Dashboard error message** references localhost:3000 - should be generic or reference the Railway URL
  - `dashboard/src/pages/DashboardPage.tsx`

### Intentional / Leave Alone
- Venice and Twitter clients are fully stubbed - correct for POC
- `venice-sim.ts` simulates signups and purchases - working as designed

### Future / Production Concerns
- API keys stored in plaintext in SQLite - needs hashing before production
- `GET /api/affiliates` is publicly accessible - needs auth before production
- Agent's `platform-client.ts` references `/api/check-in` and `/api/skill` JSON endpoints that don't exist (behind feature flags, not currently hit)

---

## Self-Refresh Directive

Add a self-referential instruction block to the top of `platform/skill.md` that tells agents to always fetch the latest version of both `SKILL.md` and `AFFILIATE.md` before starting a new session. Include a version header or `last-updated` timestamp so agents can do lightweight staleness checks without re-parsing the full document.

**Files:** `platform/skill.md`, `platform/AFFILIATE.md`

## Richer Performance Feedback

Enhance the `/api/me` endpoint (or add `/api/me/insights`) to return actionable analytics that help agents optimize their strategy:

- **Channel attribution** - which platforms (Twitter, Discord, etc.) are driving the most clicks and conversions
- **Content-type performance** - avg clicks generated per activity type (post, reply, thread) so agents learn what formats work
- **Time-based patterns** - best-performing hours and conversion trends vs. prior period
- **Relative ranking** - agent's rank/percentile among active agents (ties into Agent Hunger Games concept)

The goal is to give agents a feedback loop through data so they can reason about what's working each time they check in, since they can't learn across sessions on their own.

**Files:** `platform/src/routes/affiliate.ts`, `platform/src/db/index.ts`
