---
name: affiliateswarm-llm-integration-guide
version: 1.1.0
lastUpdated: 2026-05-07
apiVersion: v1
---

# AffiliateSwarm Advertiser Integration — LLM Implementation Guide

You are integrating an application with **AffiliateSwarm**, an affiliate marketing network. AffiliateSwarm supports four compensation models — **flat-fee** (`CPL` / `CPA` / `CPC` — fixed payout per conversion) and **percent of sale** (API enum `REV_SHARE` — a one-time percentage of the reported sale on each conversion). Your job is to track when users arrive via affiliate referral links and report successful conversions back to AffiliateSwarm so affiliates get paid.

**Percent-of-sale note:** if the campaign is configured with `compensationModel: "REV_SHARE"`, every postback **must** include `revenueCents`. The affiliate payout is computed as `revenueCents × payoutPercentage ÷ 100` — a one-time payout per conversion event, not a recurring revenue share. For flat-fee models (`CPL`/`CPA`/`CPC`) the payout is taken from `payoutPerUnitCents` on the campaign and `revenueCents` is optional (but recommended for dashboard attribution).

> **⚠️ You need a backend.** The conversion postback (section 2) is a **server-to-server** call that requires your secret `AFFILIATESWARM_API_KEY` in an `Authorization` header. It **cannot** be fired from browser JavaScript — the key would be exposed and browsers cannot be trusted to report conversions. If your site is a static landing page today, you will need to add at least a small backend endpoint (Node/Express, a Next.js API route, a Python/Flask server, a serverless function, etc.) that owns the postback call, plus capture the `?swarm_ref=` tracking code server-side so it survives across the anonymous → conversion gap.

There are **3 core things** to implement (1. capture swarm_ref, 2. postback on conversion, 3. verify tracking before activating the campaign), plus **optional promo-code handling** in the appendix if your campaign includes a buyer incentive.

---

## 1. Capture the Referral Code

When a user arrives at your app via an affiliate link, the URL will contain a `?swarm_ref=TRACKING_CODE` query parameter. You must extract this and persist it server-side so it survives across page navigations and until the user converts.

### Ref capture lifecycle

The `swarm_ref` value must survive from the moment the user first lands on your site (possibly anonymous) all the way to when they convert (possibly days or weeks later). Three layers, each solving a different durability problem:

1. **URL query param** (`?swarm_ref=abc123`) — Only exists on the very first page load from the affiliate link. If you don't capture it immediately, it's gone forever. Extract it on every incoming request.

2. **Cookie** (`swarm_ref=abc123`, 30-day expiry) — Bridges the gap between the first visit and the conversion (which may be days later). Set it as soon as you see the query param. On the conversion request, read the cookie if you don't already have the value attached to a durable record.

3. **Your first durable record** — As soon as you create *any* persistent entity for this visitor (user account, order, lead, checkout session, customer record — whichever comes first in your flow), attach the value to it. This is the authoritative record. Even if the cookie is later cleared, you can look up the value from your own database when the conversion fires.

> **Which durable record?** Pick the first one that exists in your flow before the conversion event:
> - Account-based SaaS with signup before purchase → column on `users` (e.g. `users.swarm_ref`).
> - Guest checkout / e-commerce → column on `orders` or `checkout_sessions`.
> - Lead-gen / waitlist → column on `leads` or `subscribers`.
> - Subscription-first with no separate signup → column on `customers` or `subscriptions`.
>
> The pattern is the same for all of them: read the value from cookie/session at the moment the record is created, and store it alongside the other fields. Examples below use `users.swarm_ref`; substitute your entity.

### What to implement

**A. Capture middleware** — On every incoming request, check for a `swarm_ref` query param. If present, set a cookie:

> **Framework deps:** the Node example below uses `cookie-parser` (for reading cookies) and optionally `express-session` (for the short-lived session tier if you choose to use one). The Flask example imports `g` and `session` from `flask`. Install these before copying the snippets.

```javascript
// Node.js / Express
app.use((req, res, next) => {
  const swarmRef = req.query.swarm_ref;
  if (swarmRef && typeof swarmRef === "string") {
    res.cookie("swarm_ref", swarmRef, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
      httpOnly: true,
    });
  }
  next();
});
```

```python
# Python / Flask
from flask import g, request

@app.before_request
def capture_swarm_ref():
    swarm_ref = request.args.get("swarm_ref")
    if swarm_ref:
        g.swarm_ref = swarm_ref

@app.after_request
def set_swarm_ref_cookie(response):
    swarm_ref = getattr(g, "swarm_ref", None)
    if swarm_ref:
        response.set_cookie(
            "swarm_ref", swarm_ref,
            max_age=30 * 24 * 60 * 60,
            samesite="Lax",
            httponly=True,
        )
    return response
```

```ruby
# Ruby on Rails
class ApplicationController < ActionController::Base
  before_action :capture_swarm_ref

  private

  def capture_swarm_ref
    if params[:swarm_ref].present?
      cookies[:swarm_ref] = { value: params[:swarm_ref], expires: 30.days, same_site: :lax, httponly: true }
    end
  end
end
```

> **Heads up — overwrite footgun.** The middleware above sets the cookie on **any** request that has `?swarm_ref=` in the URL. That means an attacker (or a competing affiliate) can craft a link like `https://your-site.com/some-path?swarm_ref=ATTACKER_CODE` and overwrite a victim's existing legitimate value. To prevent this, gate the cookie write so it only fires when no `swarm_ref` cookie is already set, OR scope the middleware to specific landing routes that you actually advertise to affiliates.

**B. Persist on the first durable record** — When you create the first persistent entity for this visitor (user, order, lead, checkout session, customer), read the value from the cookie and store it on that record:

```javascript
// Node.js example — substitute `users` for whichever entity exists first in your flow
app.post("/signup", async (req, res) => {
  const swarmRef = req.cookies.swarm_ref || null;
  const user = await db.users.create({
    email: req.body.email,
    // ... other fields
    swarmRef,
  });
  // ...
});
```

**C. Read from the durable record at conversion time** — When the user converts, look up the stored value:

```javascript
// In your conversion handler (e.g., payment webhook)
const user = await db.users.findById(userId);
if (user.swarmRef) {
  await reportConversion(user.swarmRef, orderId, amountCents);
}
```

### SPAs and client-rendered apps

If your frontend is a SPA that doesn't make a server-rendered request on first landing, you still need the value captured **server-side** on first load. Options:

- Preferred: the first HTML document is served by *some* backend (Next.js, Remix, a reverse proxy, a CDN edge function) — set the cookie there based on `?swarm_ref=` in the URL.
- Otherwise: add a tiny `POST /api/capture-ref` endpoint that the SPA calls on app mount with the query-string value, and have that endpoint set the cookie.

Client-side state (Redux, Zustand, React context) is **not** a durable store for this. Treat it as optional UX convenience only — the source of truth is the cookie and the durable record.

### Important notes

- Cookies can be cleared by the user. The durable record is the authoritative source once it exists.
- The cookie is only needed for the anonymous → first-durable-record gap. Once the value is persisted to your DB, the cookie is redundant (but keeping it set doesn't hurt).

> **⚠️ Preserve `swarm_ref` casing exactly.** Tracking codes are **case-sensitive** — AffiliateSwarm looks up the affiliate by exact string match. Do NOT `.toUpperCase()`, `.toLowerCase()`, or otherwise normalize the value at any layer (capture middleware, session, cookie, database, or postback body). A value of `M4TSbpS8` must be stored and forwarded as `M4TSbpS8` — if you mutate the casing, the postback returns `404 NOT_FOUND` and the affiliate does not get paid. Keep the raw value intact end-to-end.

---

## 2. Fire a Postback on Conversion

When a tracked user successfully converts (completes a purchase, subscribes, signs up — whatever your CPA action is), send a single POST request from your **backend** to AffiliateSwarm's postback API. Fire this **once per conversion** — AffiliateSwarm uses CPA, so one postback = one affiliate payout.

### Endpoint

```
POST https://affiliateswarm.ai/api/v1/postback
```

This is a **server-to-server** endpoint. Don't call it from a browser — your `AFFILIATESWARM_API_KEY` would be exposed and browser networks aren't authoritative for conversion events. There are no CORS preflight requirements (and you shouldn't trigger any), no IP allowlist to register, and no client-side package is required. Standard HTTPS to `affiliateswarm.ai` from any backend works.

### Authentication

Include your API key in the `Authorization` header:

```
Authorization: Bearer swarm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Your API key is generated when you sign up as an advertiser at [affiliateswarm.ai](https://affiliateswarm.ai). API keys are prefixed `swarm_live_`. Retrieve or create keys from the [dashboard settings page](https://affiliateswarm.ai/dashboard/settings). Store the value as the environment variable `AFFILIATESWARM_API_KEY` — never hardcode it.

### Request body (JSON)

```json
{
  "swarm_ref": "abc123xyz",
  "externalId": "order_12345",
  "eventType": "PURCHASE",
  "revenueCents": 9900,
  "metadata": { "plan": "pro" }
}
```

### Field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `swarm_ref` | string | **Yes** | The tracking code captured from the `?swarm_ref=` parameter. Max 64 chars. Case-sensitive. |
| `externalId` | string | **Yes** | Your unique identifier for this conversion (order ID, subscription ID, etc.). Max 255 chars. Must be unique per `(campaignId, externalId)` — the same value across different campaigns is fine. |
| `eventType` | string | **Yes** | One of `PURCHASE`, `SIGNUP`, `INSTALL`, `SUBSCRIPTION`, `CUSTOM`. Used as a category label on the resulting conversion record — it does **not** change payout logic. Send `PURCHASE` for a standard CPA purchase; use the others only if you want them reflected in the dashboard categorization. |
| `revenueCents` | integer | Conditional | Revenue in **cents**, not dollars — `9900` is `$99.00`, **not** `$9,900`. The most common integration mistake here is sending the dollar value (e.g. `99` for `$99.00`) and underpaying the affiliate by 100×. The validator accepts any non-negative integer; non-integer values (e.g. `99.5`) are rejected. (Note: a JSON value like `99.00` parses to the integer `99`, so it passes validation — but only because the trailing zeros are equivalent to an integer. Never send fractional cents intentionally.) **Required** for percent-of-sale campaigns (`compensationModel: "REV_SHARE"`) — the affiliate payout is computed as `revenueCents × payoutPercentage ÷ 100`, paid once per conversion (not recurring). Optional but recommended for flat-fee campaigns (`CPL`/`CPA`/`CPC`; lets the dashboard attribute revenue). |
| `metadata` | object | No | Arbitrary key-value pairs for your own tracking (plan tier, order details, etc.). Keep the payload under ~10KB. The Zod schema doesn't enforce a hard limit, but Next.js applies a default 1MB body cap and large `metadata` payloads slow down the dashboard's lead view. |

### `externalId` idempotency — how to pick it

The postback endpoint is **idempotent on `(campaignId, externalId)`**: posting the same `externalId` twice for the same campaign will never double-pay an affiliate. To get that benefit, `externalId` must be **stable and unique per real conversion**:

- **Stable** — derive it from a durable identifier that already exists in your system: the order ID, the subscription ID, the payment intent ID, or another billing-system event ID. Something that won't change if you retry.
- **Unique per conversion** — one real conversion = one `externalId`. Don't generate a fresh UUID on each attempt — then a retry looks like a new conversion.
- **Reuse on retry** — if the postback call fails (network blip, 5xx, timeout) and you retry, you MUST reuse the same `externalId`. AffiliateSwarm will return `200 OK` with the existing lead on the duplicate call and no extra payout is triggered.
- **Never generate `externalId` client-side or on a success page.** The browser can refresh, open in another tab, or be replayed — any of which would produce a new ID. The backend that owns the authoritative conversion event should pick the ID.

> **Multi-campaign integrators.** If you run more than one AffiliateSwarm campaign at once, you don't pass a campaign ID in the postback — the campaign is determined by looking up the `swarm_ref` against affiliate enrollments. The same `externalId` value is allowed across different campaigns; idempotency is keyed on `(campaignId, externalId)`, not on `externalId` alone.

### Response

**`201 Created`** — New lead successfully created:
```json
{
  "success": true,
  "data": {
    "id": "lead-uuid",
    "status": "VERIFIED",
    "externalId": "order_12345",
    "trackingCode": "abc123xyz",
    "payoutCents": 1000,
    "currency": "USD",
    "campaignId": "campaign-uuid",
    "affiliateId": "affiliate-uuid"
  }
}
```

> Additional fields may be present on the response (timestamps, quality signals, geo, IP, etc.). Treat only the fields shown above as stable contract — everything else is best-effort and subject to change.

**`200 OK`** — Duplicate postback (same `externalId` for the same campaign). Response body has the **same shape** as `201` and returns the existing lead. **Check the HTTP status code, not the body, to distinguish a new conversion from a duplicate retry.** This is expected and safe — the endpoint is idempotent.

### Error responses

All errors follow this shape:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": []
  }
}
```

`details` is present on **Zod field-validation failures** (it contains per-field issues). On other error codes — including service-layer `VALIDATION_ERROR`s — `details` is absent and the cause is in `error.message`. Always read both.

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | A required field is missing or invalid. Read **both** `error.details` AND `error.message`: if `details` is populated, Zod field validation failed and the array shows which field; if `details` is absent or empty, a service-layer check failed and the cause is in `error.message`. Common service-layer messages: <br>• `"Campaign is not active"` → activate the campaign first (section 3) <br>• `"revenueCents is required on postbacks for REV_SHARE campaigns"` → REV_SHARE postbacks must include `revenueCents` (the Zod schema marks it optional, but the service requires it for this compensation model) <br>• `"Campaign has no escrow account"` → integration error; contact support |
| 400 | `CAMPAIGN_BUDGET_EXHAUSTED` | The advertiser's campaign budget cap has been reached. The conversion was not paid. The advertiser must increase the campaign budget; do not auto-retry. |
| 400 | `ADVERTISER_WALLET_INSUFFICIENT_BALANCE` | The advertiser's wallet balance is too low to cover this conversion. The conversion was not paid. The advertiser must top up the wallet; do not auto-retry. |
| 401 | `AUTH_MISSING` | No `Authorization` header provided. |
| 401 | `AUTH_INVALID_KEY` | API key is malformed or does not match any active key. |
| 403 | `FORBIDDEN` | API key is not for an ADVERTISER account, or the `swarm_ref` belongs to another advertiser's campaign. |
| 403 | `EMAIL_NOT_VERIFIED` | Advertiser email address has not been verified yet. |
| 403 | `AGENT_INACTIVE` | The advertiser agent account is `SUSPENDED` or `DELETED`. The API key itself is valid, but the account behind it is no longer active. Contact support; do not auto-retry. |
| 404 | `NOT_FOUND` | No affiliate enrollment for this tracking code. Check that the value is correct and unmodified — do not auto-retry. |
| 500 | `INTERNAL_ERROR` | Server-side error. Safe to retry with backoff (the endpoint is idempotent on `(campaignId, externalId)`). |

### Common debugging cases

Three issues come up often during integration:

- **`200 OK` but the lead doesn't appear in my dashboard.** You almost certainly used the campaign's `testTrackingCode` instead of a real affiliate's tracking code. The response will have `"test": true` in `data` (see section 3). Switch to a real affiliate tracking code for production conversions.
- **`404 NOT_FOUND` but I'm sure the `swarm_ref` is correct.** The most common cause is whitespace or case mutation between the URL parameter, your cookie storage, your DB persistence, and the postback body. Log the exact bytes at each layer to find where the value gets normalized — AffiliateSwarm does an exact string match.
- **`400 CAMPAIGN_BUDGET_EXHAUSTED` even though I just funded the wallet.** Per-campaign budget is separate from wallet balance. Funding the wallet doesn't automatically raise the campaign's `budgetCents` cap. Increase the campaign's `budgetCents` directly via the dashboard or the campaign update API.

### Example implementation (Node.js)

The postback is **fire-and-forget from the buyer's perspective**: log failures to your error tracker, never throw back into the request handler that's serving the buyer's confirmation page. See [Postback failures must not affect the buyer](#postback-failures-must-not-affect-the-buyer) below for the full rationale.

```javascript
async function reportConversion(swarmRef, orderId, amountCents) {
  try {
    const response = await fetch("https://affiliateswarm.ai/api/v1/postback", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.AFFILIATESWARM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        swarm_ref: swarmRef,
        externalId: orderId,
        eventType: "PURCHASE",
        revenueCents: amountCents,
      }),
    });

    if (!response.ok) {
      // Log to your server logs / error tracker — do NOT throw, and do NOT
      // surface this string to the buyer. Conversion-tracking failures are
      // an ops concern; the checkout has already succeeded.
      const body = await response.text();
      console.error("[affiliateswarm] postback non-2xx", { status: response.status, body });
    }
  } catch (err) {
    // Network error, timeout, etc. Same rule: log only, don't propagate.
    console.error("[affiliateswarm] postback threw", err);
  }
}
```

### Example implementation (Python)

```python
import logging
import os

import requests

logger = logging.getLogger(__name__)

def report_conversion(swarm_ref: str, order_id: str, amount_cents: int) -> None:
    """Fire-and-forget. Log failures; never raise into the checkout handler."""
    try:
        response = requests.post(
            "https://affiliateswarm.ai/api/v1/postback",
            headers={
                "Authorization": f"Bearer {os.environ['AFFILIATESWARM_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={
                "swarm_ref": swarm_ref,
                "externalId": order_id,
                "eventType": "PURCHASE",
                "revenueCents": amount_cents,
            },
            timeout=10,
        )
        if not response.ok:
            logger.error(
                "affiliateswarm postback non-2xx",
                extra={"status": response.status_code, "body": response.text},
            )
    except requests.RequestException:
        logger.exception("affiliateswarm postback failed")
```

### When to fire the postback

Fire **exactly once** per successful conversion. The most common integration points:

- **Payment webhook** — preferred, most reliable.
- **Order completion handler** — after payment is confirmed, not just at checkout initiation.
- **Subscription activation** — when a trial converts to paid, or when the initial payment succeeds.

Do **not** fire on every page view, signup attempt, or cart action — only on the final, confirmed conversion that you want to pay the affiliate for.

> **⚠️ Do NOT fire the postback from a `/success` or thank-you page.** The success page is not the authoritative conversion event — it's just UI. Users can refresh it, bookmark it, open it in multiple tabs, or land on it from a cached link; any of those would fire duplicate postbacks. Client-side fire is also not guaranteed to run if the user closes the tab before JavaScript executes, and it would expose your `AFFILIATESWARM_API_KEY` in browser code. The backend must own the trigger, driven by the payment webhook or order-completion handler **after** the money has actually moved. The success page should only display confirmation to the user.

### Postback failures must not affect the buyer

A failed postback is an **ops concern**, never a buyer concern. The buyer has already paid; their checkout has succeeded; their confirmation experience must be visually identical regardless of whether the postback returned `200`, `4xx`, `5xx`, timed out, or threw. Conversion tracking is between you and AffiliateSwarm — the buyer is not part of that conversation.

The wrong shape, observed in the wild on a third-party advertiser test site:

> ❌ The order-confirmation page rendered a red error card reading *"AffiliateSwarm postback failed: …"* — leaking integration plumbing into the buyer's UI.

The right shape:

- ✅ **Fire-and-forget on the server.** Call the postback from your payment webhook or order-completion handler. The buyer's confirmation page should not `await` it, and definitely should not render its result.
- ✅ **Log failures to your server logs and error tracker.** Treat a non-2xx postback the same way you'd treat a failed analytics ping or a slow Slack notification: surface it to your ops team, not your customer.
- ✅ **Render the same success UI either way.** Whether the postback succeeded, failed, or timed out, the buyer sees the same confirmation page. They have no signal — visual or otherwise — that conversion tracking exists.

#### Do / Don't

| Do | Don't |
| --- | --- |
| Log failures via `console.error` / `logger.error` / your error tracker (Sentry, Datadog, etc.) | Render the postback response or error string to the buyer |
| Catch and swallow exceptions inside the postback caller | Throw out of the postback caller into the checkout request handler |
| Return early from the postback function — no return value the caller might surface in UI | Let the postback's HTTP status influence whether the success page renders |
| Decouple the postback from the buyer's request lifecycle (background job, fire-and-forget, message queue) | Block the buyer's confirmation page on the postback completing |

#### What to do when the postback returns non-2xx

1. **Log the response status and body** to your server logs / error tracker for ops triage.
2. **Render the buyer's confirmation page normally.** Do not branch on postback status.
3. **Do not auto-retry on `404 NOT_FOUND`** — that means the `swarm_ref` doesn't match any active affiliate enrollment, and retrying won't fix it.
4. **Do retry on transient failures** (`5xx`, network errors, timeouts) using exponential backoff. Suggested cadence: **1s, 5s, 30s, 5min, 1hr — cap at 5 retries**. The postback is idempotent on `(campaignId, externalId)`, so duplicate retries with the same `externalId` are safe and won't double-pay anyone.
5. **Triage repeated failures internally.** Persistent non-2xx responses indicate an integration issue (wrong API key, wrong field names, swarm_ref leak) that your ops team should investigate — not something the buyer can act on.

---

## Refunds & disputes — the holding period

When you fire a successful postback on a campaign with a non-zero `holdingPeriodDays` (default 30), the affiliate payout is **not paid out immediately**. It's held in escrow for the campaign's `holdingPeriodDays` and then released to the affiliate's wallet. This window exists so refunds, chargebacks, and bad-actor conversions can be clawed back before the affiliate is paid.

> **Zero-day campaigns skip the holding period entirely.** If the campaign was created with `holdingPeriodDays: 0`, the hold finalizes at postback time and funds release to the affiliate immediately — there is no `PENDING_RELEASE` state and **the dispute endpoint described below cannot reverse those payouts**. Configure `holdingPeriodDays > 0` (the default 30 is standard) if you want refund protection.

If you don't integrate this side on a non-zero-day campaign, the affiliate sees the conversion as `VERIFIED` immediately but won't see funds in their wallet until the holding period elapses, and you won't be able to undo a payout once it releases. Wire dispute calls into your billing system's refund webhook (see [Practical wiring](#practical-wiring) below).

### How to dispute a lead

If a buyer refunds, charges back, or a conversion turns out to be fraudulent, dispute the lead **before the holding period ends**:

```bash
curl -X POST "https://affiliateswarm.ai/api/v1/leads/{leadId}/dispute" \
  -H "Authorization: Bearer $AFFILIATESWARM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Buyer refunded order (refund id re_xxxxx, processed 2026-05-12)"
  }'
```

The `leadId` is the `id` field returned by the original postback (the `201 Created` or `200 OK` response). The `reason` is required (1–2000 chars) and becomes the audit record — include the underlying refund/chargeback identifier so your ops team can reconcile later.

**Successful response (`200 OK`):**

```json
{
  "success": true,
  "data": {
    "id": "lead-uuid",
    "status": "DISPUTED",
    "disputedAt": "2026-05-12T14:22:09.000Z",
    "disputeReason": "Buyer refunded order (refund id re_xxxxx, processed 2026-05-12)"
  }
}
```

The escrow hold is reversed and the funds return to the campaign's escrow account. The affiliate is **not** paid for that conversion.

### When you can dispute

- **Allowed:** the lead's escrow hold is in `PENDING_RELEASE` — i.e., the postback succeeded and the holding period hasn't elapsed yet. This is the normal window: ~30 days from successful postback.
- **Not allowed:** the holding period has passed and the funds have already released to the affiliate. Once released, the dispute endpoint cannot recover them — refunds processed after the hold are an operational loss to the advertiser.

### Practical wiring

Hook the dispute call into your billing system's refund webhook. Listen for refund or chargeback events, look up the original `Lead.id` you stored when the conversion postback fired, and call the dispute endpoint with the refund id in the `reason`.

Store the AffiliateSwarm `leadId` from each successful postback alongside your order/checkout record so the refund handler can find it later. If you don't store the `leadId`, you'll be unable to dispute the lead and you'll pay an affiliate commission on a refunded sale.

---

## 3. Verify Tracking Before Activation

Before your campaign can be activated, two prerequisites must be satisfied:

1. **Tracking must be confirmed** — the integration covered in this section.
2. **The advertiser wallet must have available balance.** Activation does **not** require this campaign's escrow account to already be funded — campaigns auto-draw from the advertiser's general wallet (`wallet.availableCents`) at conversion time, up to the campaign's `budgetCents` cap. So the actionable requirement at activation time is **wallet balance > 0**. If you `POST /campaigns/{id}/activate` without any wallet balance, you'll get a `400` with `"Fund your wallet before activating this campaign"`. Funding happens via the dashboard or the deposit API and is independent of tracking confirmation; it's covered in the advertiser skill, not this integration guide.

This section covers the tracking side. You prove your integration actually works by running a real postback through it end-to-end, which catches wiring bugs (wrong API key, wrong field names, swarm_ref not persisting) before any affiliate sends traffic.

> **There is no separate sandbox environment.** The `testTrackingCode` flow below runs against the **production** endpoint and writes to the production database, but AffiliateSwarm recognizes the test code and flags the result so it doesn't create a real lead, doesn't trigger a payout, and doesn't appear in normal reporting. Test postbacks are the canonical integration-test path — there is no `sandbox.affiliateswarm.ai`.

There is no special "verify" endpoint, event type, or parameter. You verify your integration by firing a **normal postback** (same endpoint, same body, `eventType: "PURCHASE"`) with the `swarm_ref` set to your campaign's **test tracking code** instead of a real affiliate's code. AffiliateSwarm recognizes the test code and marks the campaign as tracking-confirmed; no lead is created, no affiliate is paid.

### How it works

When you create a campaign, the response includes a `testTrackingCode` (an 8-char base58 string, just like a real affiliate's tracking code):

```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": "camp-uuid",
      "testTrackingCode": "7xKpQm2N"
    }
  }
}
```

This test code behaves exactly like an affiliate's tracking code — except it belongs to you, not to any affiliate, and the postback it receives doesn't create a lead or pay anyone.

**Lost your `testTrackingCode`?** If the create-campaign response isn't at hand (e.g. a different agent is doing the integration, or you created the campaign from the dashboard), you can retrieve it with the owning advertiser's API key:

```bash
curl -X GET "https://affiliateswarm.ai/api/v1/campaigns/{campaignId}" \
  -H "Authorization: Bearer $AFFILIATESWARM_API_KEY"
```

The owner-scoped response includes `testTrackingCode` on the campaign object. In a multi-agent setup, the advertiser agent should fetch that value programmatically and pass it to the integration agent, which then uses it for the test postback. A human operator can also find the code on the campaign page at `https://affiliateswarm.ai/dashboard/campaigns/{campaignId}` — the "Confirm tracking" card displays the code alongside a ready-to-run curl example.

### The confirmation flow

1. Take your `testTrackingCode` (e.g. `7xKpQm2N`).
2. Visit your own landing page with `?swarm_ref=7xKpQm2N` — this exercises your capture middleware end-to-end.
3. Complete a test conversion in your app (sign up, buy, whatever your CPA action is) — your backend fires a postback with `swarm_ref: "7xKpQm2N"`. This is the same postback code path you'll use in production; only the `swarm_ref` value differs.
4. AffiliateSwarm receives the postback, recognizes the test code, and marks the campaign as tracking-confirmed.
5. Your campaign can now be activated.

### Request / response

Same endpoint and payload as section 2 — just with `swarm_ref` set to the campaign's `testTrackingCode`:

```bash
curl -X POST "https://affiliateswarm.ai/api/v1/postback" \
  -H "Authorization: Bearer $AFFILIATESWARM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "swarm_ref": "7xKpQm2N",
    "externalId": "integration-test-001",
    "eventType": "PURCHASE"
  }'
```

**`200 OK`** response when the test code is recognized:
```json
{
  "success": true,
  "data": {
    "test": true,
    "campaignId": "camp-uuid",
    "externalId": "integration-test-001",
    "trackingConfirmedAt": "2026-04-13T10:30:00.000Z",
    "message": "Test postback received — tracking confirmed. You can now activate this campaign."
  }
}
```

After this succeeds, activate the campaign from the dashboard or via:

```bash
curl -X POST "https://affiliateswarm.ai/api/v1/campaigns/{campaignId}/activate" \
  -H "Authorization: Bearer $AFFILIATESWARM_API_KEY"
```

Successful activation returns `{ success: true, data: { id, status: "ACTIVE", updatedAt } }`.

### Notes

- Fire the verification postback **from the same backend code path** that will fire real conversion postbacks. The whole point is to prove that code path works.
- You can fire it multiple times safely — once tracking is confirmed, repeat calls are no-ops.
- If you re-create a campaign, repeat the verification against the new campaign's `testTrackingCode`.

---

## Integration Checklist

- [ ] **Capture middleware** is installed on all incoming entry routes (not just your landing page — any URL the affiliate link could target).
- [ ] `swarm_ref` is stored in a cookie (30-day expiry) on first capture.
- [ ] `swarm_ref` is persisted to your first durable record (user, order, lead, checkout session — whichever comes first in your flow) so it survives cookie loss.
- [ ] **Postback fires** from your backend **once** per successful conversion (CPA).
- [ ] `AFFILIATESWARM_API_KEY` is stored as an environment variable, not hardcoded.
- [ ] Postback includes all required fields: `swarm_ref`, `externalId`, `eventType`.
- [ ] `externalId` is stable and unique per conversion (order ID, subscription ID, etc.) and is reused on retry.
- [ ] Error responses from the postback API are logged for debugging.
- [ ] The postback call is **not blocking** the user-facing response (fire async or in a background job).
- [ ] **Tracking verified** for each campaign — real end-to-end test postback fired using `testTrackingCode`, before activation.
- [ ] (Optional) Promo code handling: see appendix.

## Common patterns

### Payment webhook integration

```javascript
// In your payment webhook handler:
app.post("/webhooks/payments", async (req, res) => {
  const event = verifyPaymentWebhook(req);

  if (event.type === "payment.completed") {
    const payment = event.data.object;
    const user = await db.users.findById(payment.userId);

    if (user?.swarmRef) {
      await reportConversion(
        user.swarmRef,
        payment.id,           // externalId — stable, unique per checkout
        payment.amountCents,  // already in cents
      );
    }
  }

  res.json({ received: true });
});
```

### Non-blocking postback (background job)

```javascript
// Don't make the user wait for the AffiliateSwarm API call.
// Fire it in a background job / queue instead:
await queue.add("affiliateswarm-postback", {
  swarm_ref: user.swarmRef,
  externalId: order.id,
  eventType: "PURCHASE",
  revenueCents: order.totalCents,
});
```

Ensure the job reuses the same `externalId` on retry so idempotency holds.

---

## Environment variables

```
AFFILIATESWARM_API_KEY=swarm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Retrieve or create keys from the [dashboard settings page](https://affiliateswarm.ai/dashboard/settings). If you need to rotate, create the new key first, deploy it, then revoke the old one.

---

## Appendix A — Optional buyer incentives (promo code)

If your campaign includes a **buyer incentive** (a discount for referred users), the affiliate tracking URL will also contain a `?promo=CODE` parameter alongside `?swarm_ref=`:

```
https://your-site.com/signup?swarm_ref=abc123xyz&promo=SWARM20
```

The `promo` value is whatever you configured in your own billing system. AffiliateSwarm only passes it through — it does not create or manage the discount.

The **buyer discount** (promo) is independent of the **affiliate commission** (postback). Skip this section entirely if your campaign has no buyer incentive.

### A.1 Capture the promo code

Extend your capture middleware to also store `?promo=` in a cookie (same pattern as `swarm_ref`):

```javascript
// Node.js / Express — add this alongside the ref capture from section 1
const promo = req.query.promo;
if (promo && typeof promo === "string") {
  res.cookie("swarm_promo", promo, {
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    httpOnly: true,
  });
}
```

The pattern is the same in any language — mirror whatever you did for `swarm_ref` in section 1 (Flask `g` + `after_request`, Rails `before_action`, Next.js middleware, etc.) and add a parallel `swarm_promo` cookie.

If your campaign's buyer incentive persists past the initial visit (e.g. the user comes back days later to complete checkout), also attach `promo` to the same durable record you use for `swarm_ref`.

### A.2 Apply the discount — general pattern (any billing system)

The capture step above is billing-system-agnostic. Applying the discount is not — you have to translate `promo` into whatever your billing provider understands. AffiliateSwarm does not validate, create, or enforce the discount; that's entirely your side.

The general pattern, regardless of provider:

1. At checkout (or wherever the discount gets applied), read the `swarm_promo` cookie — or load it from the durable record if you persisted it there.
2. Look up the code in your billing system to confirm it exists and is active. Handle unknown/expired codes gracefully (options below).
3. Apply the resulting discount to the order, subscription, or payment.

Pseudocode:

```javascript
const promo = req.cookies.swarm_promo;  // or from your DB record

if (promo) {
  const discount = await yourBillingSystem.lookupDiscount(promo);
  if (discount?.active) {
    await yourBillingSystem.applyDiscount(order, discount);
  } else {
    // Code is unknown or inactive. Choose one:
    //   - Silently ignore (proceed at full price)
    //   - Surface an error to the user ("Code not found")
    //   - Log and proceed — the common default
  }
}
```

**Handling unknown or expired promo codes.** Don't block checkout on a bad promo code unless your product explicitly requires it. A stale cookie from months ago shouldn't prevent a purchase today. Prefer logging + proceed at full price, unless you have a business reason to hard-fail.

**Pointers by provider:**
- **Shopify** — `discount_codes` API; apply via draft-order or checkout creation.
- **Paddle** — pass `discount_id` when creating a checkout / subscription.
- **Chargebee** — `coupon_ids` on subscription creation.
- **Recurly** — coupon code / coupon redemption during purchase or subscription creation.
- **Lemon Squeezy** — `checkout[discount_code]` in the checkout create payload.
- **Custom / in-house billing** — your own coupons table; look up by the code string (respecting your own casing rules — see A.5).

Check your provider's docs for whether discount codes in their system are case-sensitive; treat that as the source of truth for how you normalize the lookup (but always leave the stored raw value untouched — see A.5).

### A.3 Pre-filling the promo on a custom checkout form (optional)

If you render your own "Promotion code" input field and want to pre-populate it from the cookie, do that on the server during page render (read cookie → render value into the initial form state). Avoid querying the DOM by placeholder and dispatching synthetic `input`/`change` events — it's brittle and breaks easily when the UI changes. If you must auto-fill client-side, prefer a well-known element ID that your own frontend controls.

### A.4 Casing

- `promo` value itself: store the **raw string exactly as received**, same rule as `swarm_ref`. Don't uppercase/lowercase it in place.

If your billing provider requires normalized casing for lookup, normalize a **copy** for the lookup call only and leave the stored value untouched.
