# Shopify App for AffiliateSwarm — v1 Design

**Status:** approved (2026-05-20), modernized for current Shopify patterns (2026-05-25)
**Owner:** Omri
**Implementation branch:** `shopify-app`

> **2026-05-25 update:** Auth flow rewritten to use managed installation +
> App Bridge session tokens + token exchange, replacing the classic OAuth
> redirect flow described in earlier revisions. See the "Auth & security"
> section below for current state. Programmatic webhook registration was
> removed (TOML-only). API versions bumped to 2026-04. The checkout UI
> extension's `document.cookie` read was deleted (Shopify's checkout
> sandbox blocks DOM access) — attribution from checkout now relies
> entirely on the cart attribute set by the Theme App Extension.

## Goal

Let a Shopify merchant connect their store to AffiliateSwarm in a few clicks and
get zero-code conversion tracking. No theme edits, no postback code, no
custom checkout liquid.

## v1 scope

- **What ships:** A Shopify embedded app that authenticates a merchant's store,
  lets them paste their AffiliateSwarm advertiser API key, captures `swarm_ref`
  on the storefront via a Theme App Extension + Checkout UI Extension, and
  fires `POST /api/v1/postback` to AffiliateSwarm on every `orders/paid`
  webhook.
- **Distribution:** unlisted / custom app via install URL. Engineered to public
  Shopify App Store standards (OAuth, HMAC verification, mandatory GDPR
  webhooks) so we can submit for review later without a rewrite.

## v1 non-goals

- Refund / cancellation clawback (no AffiliateSwarm reversal endpoint exists
  today — explicitly punted to v2).
- Campaign creation or affiliate browsing inside Shopify admin.
- Auto-provisioning advertiser accounts on install (merchants sign up on
  affiliateswarm.ai first, then paste their API key).
- Public Shopify App Store submission.

## Architecture

The app lives **inside** the existing Next.js codebase under `/shopify/*`,
sharing the Postgres database, deploy pipeline, and the existing
`/api/v1/postback` endpoint. Two Shopify extensions live under
`shopify-extensions/` and get deployed via the Shopify CLI to Shopify's
infrastructure (not our Next.js server).

Three planes:

1. **Storefront plane** — Theme App Extension + Checkout UI Extension. Their
   only job: get `swarm_ref` from URL → cookie → cart attribute, so it shows up
   on the order webhook.
2. **Webhook plane** — `/shopify/webhooks/*` route handlers. HMAC-verified.
   Synchronous in-handler POST to `/api/v1/postback` with a short retry loop,
   plus Shopify's own 19-retry-over-48h delivery as a second layer.
3. **Admin plane** — `/shopify/admin` embedded page using App Bridge in the
   Shopify admin iframe. Styled with shadcn/Tailwind (matching the rest of the
   product) rather than Polaris, for engineering consistency.

## Components

| Component | Path | Purpose |
|---|---|---|
| Service module | `src/services/shopify-app/` | shop store, session-token verification, token exchange, HMAC, attribution resolver, postback forwarder |
| Embedded admin | `src/app/shopify/admin/page.tsx` (App Bridge shell) + client component + JWT-protected `api/*` routes | API key paste + connection status + test connection + recent attributed orders |
| Webhook handlers | `src/app/shopify/webhooks/{orders-paid,app-uninstalled,compliance}/route.ts` | HMAC-verified webhook receivers; one combined endpoint for the three GDPR topics |
| Discount lookup API | `src/app/api/v1/advertiser/discount-lookup/route.ts` | Bearer-auth advertiser lookup of swarm_ref by buyer coupon code |
| Theme App Extension | `shopify-extensions/extensions/swarm-attribution/` | Liquid block + JS that captures swarm_ref on landing pages |
| Checkout UI Extension | `shopify-extensions/extensions/swarm-checkout/` | React extension that propagates swarm_ref through new-checkout |
| Prisma models | `prisma/schema.prisma` | `ShopifyShop`, `ShopifyAttributedOrder` + enums |

## Data model

```prisma
enum ShopifyAttributionPath { URL_COOKIE  CHECKOUT_EXT  DISCOUNT_CODE  NONE }
enum ShopifyPostbackStatus  { PENDING  SUCCESS  FAILED  SKIPPED }

model ShopifyShop {
  id                    String   @id @default(uuid()) @db.Uuid
  shopDomain            String   @unique @db.VarChar(255)
  accessToken           String   @db.VarChar(512)       // encrypted via HMAC_ENCRYPTION_KEY
  scopes                String   @db.VarChar(512)
  advertiserApiKey      String?  @db.VarChar(512)       // encrypted; null until merchant pastes one
  advertiserApiKeyValid Boolean  @default(false)
  installedAt           DateTime @default(now())
  uninstalledAt         DateTime?
  lastWebhookAt         DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  attributedOrders      ShopifyAttributedOrder[]
}

model ShopifyAttributedOrder {
  id              String   @id @default(uuid()) @db.Uuid
  shopId          String   @db.Uuid
  shop            ShopifyShop @relation(fields: [shopId], references: [id])
  shopifyOrderId  String   @db.VarChar(64)
  swarmRef        String?  @db.VarChar(64)
  discountCode    String?  @db.VarChar(64)
  attributionPath ShopifyAttributionPath
  revenueCents    Int
  postbackStatus  ShopifyPostbackStatus
  postbackError   String?  @db.Text
  postbackLeadId  String?  @db.VarChar(64)
  attemptCount    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([shopId, shopifyOrderId])
}
```

The `(shopId, shopifyOrderId)` unique constraint is the idempotency boundary —
Shopify can deliver the same webhook many times, our database accepts it once.

## Attribution priority

When `orders/paid` fires we run a resolver that tries each path in order; first
hit wins:

1. **`note_attributes['swarm_ref']`** — set by either extension. We also write
   `swarm_source` (`theme` or `checkout_ext`) alongside so we can distinguish
   `URL_COOKIE` vs `CHECKOUT_EXT` for the audit record.
2. **`discount_codes[]`** — for each code on the order, call
   `GET /api/v1/advertiser/discount-lookup?code=...` using the shop's API key.
   First match wins. Cached for 5 min per (shop, code) in-process to keep
   webhook latency low.
3. **None** — record as `SKIPPED`.

## Storefront extension behaviour

**Theme App Extension** (`swarm-attribution`):
- On page load: if `?swarm_ref=` is present and matches `^[A-Za-z0-9_-]{6,32}$`,
  store in a 30-day cookie (SameSite=Lax, path=/).
- On add-to-cart and on checkout-link click: `POST /cart/update.js` with
  `attributes[swarm_ref]` + `attributes[swarm_source]=theme`. Fire-and-forget.

**Checkout UI Extension** (`swarm-checkout`):
- Targets `purchase.checkout.block.render`. Reads cookie + query string.
  Calls `applyAttributeChange` with `swarm_ref` + `swarm_source=checkout_ext`.
  Runs on every checkout including post-payment retries.

## Postback pipeline

`/shopify/webhooks/orders-paid` (POST):

1. Verify HMAC (`X-Shopify-Hmac-SHA256` against raw body using the app's
   API secret). Reject 401 on mismatch.
2. Look up shop by `X-Shopify-Shop-Domain`. If no API key configured →
   record `SKIPPED { reason: "no_api_key" }`, return 200.
3. Idempotency: insert `ShopifyAttributedOrder` with
   `(shopId, shopifyOrderId)`. On conflict, return 200 with the existing row.
4. Run resolver. If `NONE` → mark `SKIPPED { reason: "no_attribution" }`,
   return 200.
5. POST to AffiliateSwarm `/api/v1/postback` using the shop's stored advertiser
   API key. Body:
   ```json
   {
     "swarm_ref": "...",
     "externalId": "shopify_<shopId>_<orderId>",
     "eventType": "PURCHASE",
     "revenueCents": <current_subtotal_price * 100>,
     "metadata": { "orderId": "...", "shopDomain": "...", "discountCode": "..." }
   }
   ```
   Timeout 5s, in-handler retry up to 2 times on 5xx/timeout with 200ms+500ms
   backoff.
6. On success → store `postbackLeadId`, mark `SUCCESS`, return 200.
7. On 4xx → mark `FAILED` with the error, return 200 (Shopify retry won't help).
8. On 5xx or timeout after retries → mark `FAILED`, return **500** so Shopify
   retries the webhook (up to 19 retries over 48h).

Other webhook handlers:
- `app/uninstalled` — set `uninstalledAt`, clear `accessToken`, keep history.
- `customers/data_request`, `customers/redact`, `shop/redact` (GDPR) — we
  store no PII (only order IDs, swarm_ref, revenue). Return 200 with a stub
  note.

## AffiliateSwarm-side changes

1. **New endpoint** `GET /api/v1/advertiser/discount-lookup?code=XYZ`:
   - Bearer auth, `ADVERTISER` role, email verified.
   - Returns the swarm_ref for an *active* enrollment in an *active* campaign
     owned by the calling advertiser, where the campaign's `buyerCouponCode`
     equals `XYZ`. The discount code identifies the campaign; we need a single
     enrollment to know which affiliate gets credit.
   - **Important nuance:** `buyerCouponCode` is a campaign-level field today
     (one code per campaign). For v1 the lookup returns the first affiliate's
     swarm_ref enrolled to that campaign. This is a known limitation —
     per-affiliate discount codes are a separate v2 feature.
   - 404 if no match. Cached client-side in the Shopify app for 5 minutes.

2. **Advertiser dashboard Shopify status** — a small "Connected Shops" card on
   the existing settings page showing each connected shop, install time, and
   recent attributed order count. Read-only.

## Auth & security

- **Managed installation:** Shopify handles install entirely from the scopes
  declared in `shopify.app.toml`. No `/shopify/auth/install` or `/callback`
  routes — Shopify just deep-links the merchant straight to `/shopify/admin`
  inside the admin iframe after they approve.
- **App Bridge session tokens:** the embedded admin loads
  `https://cdn.shopify.com/shopifycloud/app-bridge.js` with a
  `<meta name="shopify-api-key">`. App Bridge auto-injects
  `Authorization: Bearer <jwt>` on same-origin fetches. All
  `/shopify/admin/api/*` routes verify the JWT (HS256 against the app
  secret) before doing anything shop-scoped — see
  `src/services/shopify-app/session-token.ts`.
- **Token exchange:** on the first admin visit, the backend trades the
  session token for an offline access token via
  `POST /admin/oauth/access_token` with
  `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`. Cached
  encrypted on the `ShopifyShop` row. Implementation:
  `src/services/shopify-app/token-exchange.ts`.
- **Webhook HMAC:** every webhook is verified against the app secret over
  the raw body. Constant-time compare. Webhooks are declared in
  `shopify.app.toml` only — no programmatic registration.
- **Token encryption at rest:** access tokens and pasted API keys are
  AES-256-GCM encrypted using `HMAC_ENCRYPTION_KEY` (existing env var; same
  key already used for other secrets in this project). Helper:
  `src/lib/shopify/crypto.ts`.
- **CSP for embedded admin:** `/shopify/admin/*` returns
  `Content-Security-Policy: frame-ancestors https://*.myshopify.com https://admin.shopify.com;`
  and does NOT set `X-Frame-Options`. The global X-Frame-Options rule in
  `next.config.ts` is updated to exclude `/shopify/admin/*`.

## Error handling & observability

- All Shopify-related logs use `logger.child({ component: "shopify-app" })`
  with `shopDomain` and `shopifyOrderId` in the bound context.
- AppError subclasses (`ValidationError`, `ForbiddenError`, etc.) are reused
  for the discount-lookup endpoint. Webhook handlers return raw 200/500
  (Shopify doesn't read JSON error bodies).
- Failures recorded on `ShopifyAttributedOrder.postbackError` for the admin
  page to surface.

## Testing strategy

Vitest unit tests for the service layer (no DB needed where possible, Prisma
mocked otherwise):
- HMAC verification (webhook + install URL — known-good and tampered cases)
- OAuth state cookie nonce verification
- Attribution resolver (URL path wins over discount-code, NONE case)
- Postback forwarder retry behaviour (5xx → retry, 4xx → no retry, timeout)
- Encryption round-trip

E2E and live Shopify integration must be done manually with a real Shopify
Partner account and `shopify app dev` — that part is documented in the
`shopify-extensions/README.md` and is out of scope for this PR's automated
testing.

## What this PR ships

Code: all backend routes, service layer, Prisma migration, embedded admin
page, both Shopify extension scaffolds, AS-side discount-lookup endpoint,
advertiser dashboard "Connected Shops" card, tests, env.example updates,
operator docs.

Not in this PR (requires Shopify Partner account + manual steps the agent
can't perform):
- Actually creating the Shopify app in Shopify Partners dashboard
- Running `shopify app deploy` to publish the extensions
- Setting `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` in production env
- End-to-end test in a real Shopify dev store

These steps are documented in `docs/shopify-app.md` for the operator to run.

## v2 ideas (out of scope)

- Refund clawback: `POST /api/v1/postback/reverse` endpoint + `refunds/create`
  webhook handler.
- Per-affiliate discount codes (so the discount-code path doesn't have to pick
  "first enrollment wins").
- Embedded campaign creation + affiliate browsing inside Shopify admin.
- App Store submission and billing.
