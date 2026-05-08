# Advertiser Integration: Pixel vs Webhook

This document summarizes the two integration options for advertisers listing campaigns on the Regatta marketplace. It is intended as a handoff document for technical and non-technical stakeholders.

---

## Background

When an affiliate on Regatta refers a user to an advertiser, Regatta needs to know when that referral converts — i.e., when the referred user signs up or makes a purchase. This is how Regatta attributes the commission to the correct affiliate.

Regatta handles the click side: when a user clicks an affiliate's Regatta link, Regatta logs the click and redirects the user to the advertiser's site. The conversion side is where the advertiser is involved.

There are two ways an advertiser can tell Regatta about a conversion.

---

## Option A: JavaScript Conversion Pixel

### How it works

Regatta provides a small JavaScript snippet. The advertiser pastes it on their order confirmation or post-signup page — the page a user sees after completing a purchase or registration. When that page loads, the script fires automatically and notifies Regatta that a conversion occurred.

The attribution works via a cookie. When a user clicks a Regatta affiliate link, Regatta drops a cookie in their browser storing the affiliate's ID. When the user later completes a purchase and the confirmation page loads, the pixel reads that cookie and tells Regatta which affiliate to credit.

```html
<!-- Advertiser pastes this on their confirmation page -->
<script src="https://regatta.network/pixel.js"
  data-campaign="your-campaign-id"
  data-order-id="{{ order.id }}"
  data-amount="{{ order.total }}">
</script>
```

### Pros

- No backend development required from the advertiser
- Can be installed by a web team or marketer in under 30 minutes
- Works with any CMS, Shopify store, or static page
- Low barrier — scales to many advertisers without a support burden

### Cons

- Relies on browser cookies, which can be blocked by privacy tools and iOS tracking restrictions
- Attribution only works if the user converts in the same browser they clicked from
- Cookie lifespan limits the attribution window (typically 30–90 days)
- Less reliable than server-side tracking for high-value conversions

---

## Option B: Server-Side Webhook

### How it works

The advertiser's backend sends an HTTP POST request to a Regatta endpoint when a conversion occurs. The request includes the order details and the affiliate sub-ID that Regatta passed to the advertiser when the user clicked through.

**How the sub-ID gets to the advertiser:**

When a user clicks a Regatta affiliate link, Regatta appends a unique identifier to the destination URL before redirecting:

```
User clicks:    regatta.network/r/ashe/venice
Regatta logs the click, then redirects to:
                venice.ai/signup?sub=aff_abc123
```

The advertiser stores `aff_abc123` alongside the user record at signup. When the user purchases, the advertiser fires a webhook to Regatta including that sub-ID so Regatta knows which affiliate to credit.

```json
POST https://regatta.network/api/webhooks/venice

{
  "event": "purchase",
  "sub": "aff_abc123",
  "orderId": "ord_xyz789",
  "amountUsd": 99.00
}
```

**What Regatta needs to build for this:**

Regatta must host and maintain a dedicated webhook endpoint for each advertiser. This endpoint receives the conversion event, validates it came from a trusted source (via a shared secret or signature), looks up the affiliate by sub-ID, and credits their account. Each advertiser gets their own endpoint and shared secret at onboarding.

### Pros

- More reliable than cookie-based tracking — not affected by browser privacy restrictions
- Works regardless of device switching or delayed conversions
- Clean server-to-server communication with full audit trail
- Better suited for high-value or high-trust advertiser relationships

### Cons

- Requires backend developer time from the advertiser — typically several hours to a few days
- Advertiser must store and pass the sub-ID through their purchase flow
- Regatta must build and maintain a webhook endpoint per advertiser
- Higher onboarding friction — not suitable for non-technical advertisers

---

## Comparison Summary

| | Pixel | Webhook |
|---|---|---|
| Advertiser technical requirement | Paste a script tag | Backend developer work |
| Reliability | Moderate (cookie-dependent) | High (server-to-server) |
| Privacy / tracking restrictions | Affected | Not affected |
| Time to integrate | 30 minutes | Several hours |
| Best for | Most advertisers, fast onboarding | Technical advertisers, high-value campaigns |
| Regatta build requirement | Host pixel script + conversion endpoint | Build per-advertiser webhook endpoint |

---

## Recommendation

Offer both. Use the pixel as the default integration path for advertiser onboarding — it removes the technical barrier and makes listing a campaign accessible to any advertiser. Offer the webhook as a premium option for advertisers who need higher attribution reliability or are already running webhook-based infrastructure (e.g., Stripe billing events).

For the first advertiser (Venice), the webhook is the right choice given their technical capability and the importance of accurate attribution at launch.

---

*Regatta — Agent-Native Affiliate Marketplace*
