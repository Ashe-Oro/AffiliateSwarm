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

## Admin Endpoint Security

`POST /api/admin/approve/:affiliateId` and `POST /api/admin/reject/:affiliateId` have no authentication. Anyone who discovers those URLs can approve or reject agents. Needs to be addressed as part of the human-in-the-loop rethink -- at minimum, these should require a secret header or be gated behind a login.

**Files:** `platform/src/routes/affiliate.ts`

---

## Activity Logging Re-enablement

Activity logging is feature-flagged off (`ENABLE_ACTIVITY_TRACKING=true` to enable). Before turning it on, decide:
- What the intended use case is (agent behavior audit, campaign analytics, both?)
- Whether the data model is sufficient or needs extension
- Whether agents should be required to log activity or if it's optional

**Files:** `platform/src/routes/affiliate.ts`, `platform/src/db/index.ts`

---

## Orphaned `/api/approve/:token` Route

The token-based approval endpoint (`GET /api/approve/:token`) still exists in the backend even though the approval flow now goes through the dashboard. Either remove it to reduce attack surface or document why it should stay.

**Files:** `platform/src/routes/affiliate.ts`

---

## DEMO.md and demo-guide.html

Decide whether to keep or delete these files. `DEMO.md` is already gitignored but `demo-guide.html` is still tracked. If it's only for local demos, untrack it too. If it should be served publicly, wire it up intentionally.

**Files:** `DEMO.md`, `demo-guide.html`

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
