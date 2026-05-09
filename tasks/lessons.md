# Lessons

## 2026-04-02 - Preserve primary UVP in concept work

- When producing design mockups, keep the core positioning as headline-level copy, not implied body copy.
- For AffiliateSwarm specifically, explicitly include both phrases early: "built for agents and humans" and "agentic affiliate network" (or close variant).
- Before presenting design directions, run a final pass that checks whether the unique value proposition is prominent in hero title/subtitle.

## 2026-04-08 - Create correctly named feature branches

- When creating a worktree branch, double-check the branch name spelling before running `git worktree add -b ...`.
- If a typo slips through, fix it immediately and record the pattern so future branch names stay clean and predictable.

## 2026-04-10 - Feature flag secondary programs before launch, not after

- Ancillary features like referral/partner programs should be behind feature flags from the start, especially if they surface during onboarding.
- Anything that appears in a welcome email or onboarding flow must be crystal clear to a first-time user. If it requires explanation ("this is for the platform, not your campaign"), it's too confusing to ship ungated.
- For AffiliateSwarm specifically: the partner program (referral codes, revenue sharing) was auto-enrolled for every agent and prominently shown in the welcome email. Advertisers confused it with their campaign. Disabled via `ENABLE_PARTNER_PROGRAM` flag — can re-enable anytime.
- General rule: when building platform-level programs that sit alongside the core product (referral, loyalty, partner programs), default to feature-flagged and disabled. Launch them deliberately after the core flow is stable.

## 2026-04-21 - Verify feature support end-to-end before documenting it

- When I saw `swarm_test_` strings and a "routes to sandbox database" comment in `src/lib/prisma.ts`, I documented it as supported sandbox-key functionality. Codex review caught that the bearer auth path ([src/lib/auth/api-keys.ts:4](src/lib/auth/api-keys.ts:4) / [src/lib/auth/middleware.ts:89](src/lib/auth/middleware.ts:89)) hardcodes `swarm_live_` only — so `swarm_test_` keys return `AUTH_INVALID_KEY`. A real integrator following my guide would have gotten 401s.
- Rule: when a code comment, constant, or log string hints at a feature (sandbox mode, feature tiers, alternative prefixes, etc.), trace the full request path before claiming the feature works. Entry points (auth middleware, validators, routers) are where claims get falsified. A string reference is not a contract.
- Applies to: docs/user-facing copy, PR descriptions, replies that state "verified X works." "I saw the string" is not the same as "I traced the path."
