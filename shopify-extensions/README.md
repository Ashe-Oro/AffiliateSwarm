# AffiliateSwarm Shopify Extensions

Shopify CLI workspace for the two storefront/checkout extensions that ship
with the AffiliateSwarm Shopify app.

| Extension | Type | What it does |
|---|---|---|
| `swarm-attribution` | Theme App Extension | Captures `?swarm_ref=` on landing, stores in a 30-day cookie, attaches as a cart attribute on add-to-cart and checkout |
| `swarm-checkout` | Checkout UI Extension | Reads the cookie inside Shopify's new checkout and writes the same attribute (covers paths that bypass the cart, e.g. native pay buttons) |

The Next.js backend (OAuth, webhooks, embedded admin) lives in the main repo
under `src/app/shopify/*` — these extensions are deployed separately via
the Shopify CLI to Shopify's infrastructure.

## Prerequisites

1. A Shopify Dev Dashboard account (the successor to the Partner Dashboard
   for app management — Shopify deprecated legacy custom-app creation in
   January 2026).
2. An app created in the Dev Dashboard with the same name (so the CLI can
   link it). Choose distribution = **Public > Unlisted** for a shareable
   install link.
3. `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` set in your environment.
4. `SHOPIFY_APP_URL` pointing at your deployed Next.js app
   (or a tunnel like ngrok during local dev).

## Local dev

```bash
cd shopify-extensions
npm install
npm run dev
# follow CLI prompts to pick the Partner org, dev store, and link the app
```

`shopify app dev` will also set up a tunnel that points the Partners app
config at your local Next.js server — so OAuth + webhooks fire against your
local machine.

## Deploying to Shopify

```bash
npm run deploy
```

This publishes a new version of both extensions **and pushes the app
config** (webhooks, scopes, app URL) defined in `shopify.app.toml`. The
legacy `shopify app config push` command was removed in CLI v3.x — config
now rides with `shopify app deploy`.

The Next.js server has to be re-deployed separately (it lives in the
parent repo).

## What ships with the Next.js repo, what ships from here

| Concern | Lives in |
|---|---|
| Session-token + token-exchange auth | Next.js `src/services/shopify-app/{session-token,token-exchange}.ts` |
| Webhook handlers (orders/paid, app/uninstalled, GDPR compliance) | Next.js `src/app/shopify/webhooks/*` |
| Embedded admin page + App Bridge + JWT-protected APIs | Next.js `src/app/shopify/admin/*` |
| Theme + Checkout extensions | This directory, deployed via `shopify app deploy` |
| Shopify app config (Partners) | `shopify.app.toml` in this directory, pushed with `shopify app config push` |
