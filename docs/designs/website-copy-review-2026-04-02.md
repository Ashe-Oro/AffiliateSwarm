# Website Copy Review - 2026-04-02

## Scope

- Home page: `src/app/page.tsx`
- Marketing pages: `src/app/(marketing)/for-affiliates/page.tsx`, `src/app/(marketing)/for-advertisers/page.tsx`, `src/app/(marketing)/partners/page.tsx`, `src/app/(marketing)/pricing/page.tsx`, `src/app/(marketing)/docs/page.tsx`
- Conversion path copy: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/onboarding/page.tsx`
- Shared copy: `src/components/marketing/navbar.tsx`, `src/components/marketing/footer.tsx`

## What Is Strong

- Positioning is clear and differentiated: AffiliateSwarm is consistently described as affiliate infrastructure for AI agents.
- Audience segmentation is strong: separate flows for affiliates, advertisers, and partners are already in place.
- Mechanism-level credibility is good: escrow, postbacks, referral tokens, and verification are concrete and useful.
- Prompt-driven activation is memorable: "Tell your agent" and "Read .../skill.md" are distinctive onboarding cues.

## What Is Weak

- Messaging density is high on top-of-funnel pages; key value props are buried in long blocks.
- Repetition is heavy across pages, especially around skill file instructions and "your agent does everything" phrasing.
- Some claims are too absolute and can undermine trust if real behavior is conditional.
- Some navigation and CTA labels are inconsistent with page language ("sellers" vs "advertisers", "publishers" vs "affiliates").

## What Is Wrong Or Risky

- Pricing and partner pages can be read as contradictory:
  - Pricing says no platform fees.
  - Partners says revenue share is paid from "AffiliateSwarm's cut."
  - This needs one explicit fee model statement used across both pages.
- "No human intervention" and "instant" payout wording appear stronger than the implementation implied elsewhere.
- "Unlimited rate limits (6000 req/min)" is self-contradictory and should be rewritten.

## Duplication Patterns

- Near-identical skill prompts repeat on home, affiliates, advertisers, and partners.
- Escrow and payout messaging repeats with minor wording differences.
- AI-to-AI referral explanation repeats without adding new detail in later sections.
- "Built for agents" idea appears in hero, features, footer, and docs intros.

## What To Remove Or Collapse

- Reduce duplicate "Tell your agent" blocks to one strong block per page.
- Remove repeated explanatory text immediately following code prompt cards when it adds no new information.
- Collapse overlapping capability sections on role pages into one concise "How it works" plus one proof section.

## Clarity Gaps To Fix

- Add a single canonical explanation of payout timing:
  - "automatic release on verification"
  - plus expected settlement/withdrawal timing by method.
- Add one canonical verification policy sentence on role pages:
  - what is auto-verified,
  - what may require manual review,
  - and what triggers release.
- Clarify login path for users who do not yet have an agent-issued code.

## Recommended Copy Direction

1. Lead with one sentence answer to "why AffiliateSwarm" on each page.
2. Keep one role-specific promise per section and avoid re-explaining shared mechanics.
3. Replace absolutes with precise, defensible language.
4. Normalize vocabulary:
   - advertisers (not sellers)
   - affiliates (not publishers, unless intentionally distinct)
   - register vs connect vs onboard (pick one per context).

## High-Priority Rewrites

- Home hero subcopy: shorten to one narrative sentence + one operational sentence.
- Pricing and partners: introduce a single fee model paragraph reused verbatim.
- Affiliate trust tiers: fix "unlimited" phrasing and tighten benefit bullets.
- Login page: add one line guidance for first-time users without an agent code.

## Design Skills Applied In Mockups

- Narrative hierarchy design (one promise per section, faster scanning)
- Typographic direction (purposeful type pairings per concept)
- Visual systems (color tokens, gradients, textured backgrounds)
- Motion design (staggered reveals and ambient movement)
- Responsive composition (desktop and mobile-safe section flow)
