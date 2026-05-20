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
  (OAuth, webhooks, embedded admin, postback forwarder).
- `shopify-extensions/` — the Theme App Extension and Checkout UI Extension,
  deployed via the Shopify CLI separately from this Next.js app.

## One-time operator setup

### 1. Create the app in Shopify Partners

1. Go to <https://partners.shopify.com> → Apps → Create app → "Create app
   manually".
2. Name: `AffiliateSwarm`.
3. App URL: `https://YOUR_DEPLOYMENT/shopify/auth/install`.
4. Allowed redirection URL: `https://YOUR_DEPLOYMENT/shopify/auth/callback`.
5. Copy the **Client ID** (this is `SHOPIFY_API_KEY`) and **Client secret**
   (`SHOPIFY_API_SECRET`).

### 2. Configure environment variables

In production (Railway / Vercel / wherever the Next.js app runs):

```
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=https://your-deployment.example.com
SHOPIFY_APP_SCOPES=read_orders,write_orders
SHOPIFY_API_VERSION=2025-01
```

`SHOPIFY_APP_URL` must be HTTPS and reachable from Shopify's servers.

### 3. Deploy the storefront/checkout extensions

```bash
cd shopify-extensions
npm install
# Link to the Partners app you just created
npx shopify app config link
# Push the app config (webhooks, app URL, scopes) to Partners
npx shopify app config push
# Deploy the Theme App Extension + Checkout UI Extension
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

1. Operator (you) sends the merchant the install URL:
   `https://YOUR_DEPLOYMENT/shopify/auth/install?shop=THEIR-STORE.myshopify.com`
   (or, once submitted, the App Store listing).
2. Merchant approves OAuth in Shopify, lands on `/shopify/admin`.
3. Merchant pastes their AffiliateSwarm advertiser API key
   (from `https://affiliateswarm.ai/dashboard/settings`).
4. Merchant pastes their campaign's `testTrackingCode` and clicks "Fire test
   postback" — confirms tracking, unlocks the campaign in AffiliateSwarm.
5. Merchant enables the **AffiliateSwarm tracking** theme app block in their
   theme editor (one click — adds the storefront script to `<head>`).
6. Done. Every paid order with `?swarm_ref=…` in the buyer's session, or a
   matching discount code on the order, fires a postback automatically.

## How attribution resolves

For each `orders/paid` webhook, the resolver tries each path in order:

1. **`note_attributes['swarm_ref']`** — set by either extension on the cart
   or checkout.
2. **`discount_codes[]`** — for each code on the order, look up
   `GET /api/v1/advertiser/discount-lookup?code=…` against AffiliateSwarm
   using the shop's stored API key. First match wins.
3. **No match** → record as `SKIPPED`, return 200.

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
- **Discount-code attribution always misses** — the matching campaign needs
  to be `ACTIVE` and have at least one `APPROVED` enrollment with a
  `trackingCode`. The lookup attributes to the earliest-approved affiliate
  on the campaign.
