# Shopify App — Operator Guide

AffiliateSwarm ships an embedded Shopify app that gives merchants zero-code
conversion tracking: a customer lands with `?swarm_ref=…`, buys something,
and `/api/v1/postback` fires automatically.

This doc covers operator setup. End-user (merchant) onboarding lives inside
the embedded admin page itself.

## Architecture overview

```
shopper                       merchant's shop                     AffiliateSwarm
───────                       ───────────────                     ──────────────
visits site ?swarm_ref=…  →   Theme App Extension stores
                              swarm_ref in cookie + cart attr

buys something            →   orders/paid webhook  →  /shopify/webhooks/orders-paid
                                                          │
                                                          ├─ HMAC verify
                                                          ├─ idempotent insert
                                                          ├─ resolve attribution
                                                          └─ POST /api/v1/postback
```

Code lives in two places:

- `src/app/shopify/*` and `src/services/shopify-app/*` — the Next.js side
  (embedded admin, webhooks, attribution resolver, postback forwarder,
  session-token verification, token exchange).
- `shopify-extensions/` — the Theme App Extension and Checkout UI Extension,
  deployed via the Shopify CLI separately from this Next.js app.

## Auth model (2026)

We use **managed installation** + **App Bridge session tokens** + **token
exchange**. There is no manual OAuth redirect — Shopify handles the install
flow itself from the scopes declared in `shopify.app.toml`, and our backend
trades the App Bridge session JWT for a shop access token on demand.

Practically this means:
- No `/shopify/auth/install` or `/shopify/auth/callback` routes.
- The Application URL in Shopify config points directly at `/shopify/admin`.
- The embedded admin page loads `https://cdn.shopify.com/shopifycloud/app-bridge.js`
  and a `<meta name="shopify-api-key">`; App Bridge then auto-injects
  `Authorization: Bearer <session-token>` on same-origin fetches.
- Server APIs (`/shopify/admin/api/*`) verify the JWT with HS256 against
  `SHOPIFY_API_SECRET` before doing anything shop-scoped.

## One-time operator setup

### 1. Create the app in the Shopify Dev Dashboard

> Note: legacy custom apps created in the Shopify admin can no longer be
> created (Shopify deprecated this path in January 2026). All new apps must
> be created in the Dev Dashboard.

1. Go to <https://shopify.dev/dashboard> → Apps → Create app.
2. Name: `AffiliateSwarm`.
3. Distribution:
   - Pick **Public > Unlisted** if you want a stable install link you can
     share with multiple merchants (recommended). The app will not appear
     in App Store search until you submit it for review.
   - Pick **Custom** if you only want to install on one named store.
4. After creating, copy the **Client ID** (this is `SHOPIFY_API_KEY`) and
   **Client secret** (`SHOPIFY_API_SECRET`).

### 2. Configure environment variables

In production (Railway / Vercel / wherever the Next.js app runs):

```
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=https://your-deployment.example.com
SHOPIFY_APP_SCOPES=read_orders,write_orders
SHOPIFY_API_VERSION=2026-04
```

`SHOPIFY_APP_URL` must be HTTPS and reachable from Shopify's servers.

### 3. Push app config + deploy extensions

```bash
cd shopify-extensions
npm install
# Link to the app you just created in the Dev Dashboard. This generates
# a `shopify.app.<handle>.toml` (e.g. shopify.app.affiliate-swarm.toml)
# from the Shopify-side config. Commit that file.
npx shopify app config link
# Open the generated TOML and:
#  - set `application_url` to your production HTTPS URL
#  - confirm `scopes = "read_orders,write_orders"`
#  - confirm webhook subscriptions use RELATIVE paths
#    (e.g. "/shopify/webhooks/orders-paid"). Shopify CLI does NOT do
#    `${VAR}` substitution — absolute URLs must be hard-coded.
# Then deploy extensions AND push the config (the legacy
# `shopify app config push` was removed in CLI v3.x — config rides with
# `app deploy`):
npm run deploy
```

After this, merchants who install the app get the extensions available in
their theme editor and checkout.

### 4. Run the database migration

```bash
npx prisma migrate deploy
```

Adds `shopify_shops` and `shopify_attributed_orders` tables.

## Merchant onboarding (what the end user does)

1. Operator (you) sends the merchant the install URL from the Dev Dashboard
   (or, once submitted, the App Store listing).
2. Merchant clicks install, Shopify shows the managed-install scope prompt,
   merchant approves, lands on `/shopify/admin` inside the Shopify admin
   iframe.
3. On first load the page asks Shopify for a session token via App Bridge,
   the backend trades it for an access token, and persists a
   `ShopifyShop` row.
4. Merchant pastes their AffiliateSwarm advertiser API key
   (from `https://your-deployment.example/dashboard/settings`).
5. Merchant pastes their campaign's `testTrackingCode` and clicks "Fire
   test postback" — confirms tracking, unlocks the campaign in
   AffiliateSwarm.
6. Merchant enables the **AffiliateSwarm tracking** theme app block in
   their theme editor (one click — adds the storefront script to `<head>`).
7. Done. Every paid order with `?swarm_ref=…` in the buyer's session, or
   a matching discount code on the order, fires a postback automatically.

## How attribution resolves

For each `orders/paid` webhook, the resolver tries each path in order:

1. **`note_attributes['swarm_ref']`** — set by either extension on the cart.
2. **`discount_codes[]`** — for each code on the order, look up
   `GET /api/v1/advertiser/discount-lookup?code=…` against AffiliateSwarm
   using the shop's stored API key. First match wins.
3. **No match** → record as `SKIPPED`, return 200.

The Checkout UI Extension cannot read storefront cookies (Shopify's
checkout sandbox is a Web Worker with no DOM access) — it's an observer
only. The cart attribute, written by the Theme App Extension on
add-to-cart and checkout-link clicks, is the only client→server bridge.

## Refunds (v2)

Refunds are not propagated in v1. If a merchant refunds an order after a
postback fired, the affiliate keeps the credit. The current AffiliateSwarm
postback API has no reversal endpoint; building one is tracked separately.

## Troubleshooting

- **Webhook returns 401** — usually a wrong `SHOPIFY_API_SECRET`. Re-check
  env vars on the running deployment.
- **Webhook returns 500** — transient failure forwarding to `/api/v1/postback`.
  Shopify will retry ~19 times over 48h. Check the
  `shopify_attributed_orders` table for the row and look at `postbackError`.
- **Admin iframe shows blank page** — CSP misconfigured. `/shopify/admin/*`
  must serve `Content-Security-Policy: frame-ancestors https://*.myshopify.com
  https://admin.shopify.com;` (configured in `next.config.ts`).
- **Admin page loads but `/me` returns 401** — App Bridge isn't injecting
  the session token. Confirm the `<meta name="shopify-api-key">` tag is
  present and the value matches the deployed `SHOPIFY_API_KEY`.
- **Discount-code attribution always misses** — the matching campaign needs
  to be `ACTIVE` and have at least one `APPROVED` enrollment with a
  `trackingCode`. The lookup attributes to the earliest-approved affiliate
  on the campaign.
