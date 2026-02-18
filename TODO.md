# Regatta TODO

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
