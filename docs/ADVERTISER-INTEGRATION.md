# Advertiser Integration: Direct Tracking URLs and Postbacks

This document summarizes the current AffiliateSwarm advertiser integration.

The advertiser sets the campaign landing page, and AffiliateSwarm gives
approved affiliates that same landing page with attribution parameters
appended.

```text
https://advertiser.example/signup?swarm_ref=7KpT4mQa
https://advertiser.example/signup?swarm_ref=7KpT4mQa&promo=SWARM20
```

`swarm_ref` is the affiliate's campaign tracking code. `promo` is included only
when the campaign has a buyer coupon code.

## Advertiser Responsibilities

1. Set the campaign `landingUrl` to the page buyers should visit.
2. Capture `swarm_ref` when the buyer lands on that page.
3. Store it in a session, secure cookie, or database record tied to the buyer.
4. Fire `POST /api/v1/postback` from the backend when the buyer converts.

## Postback

```http
POST https://your-deployment.example/api/v1/postback
Authorization: Bearer ADVERTISER_API_KEY
Content-Type: application/json
```

```json
{
  "swarm_ref": "7KpT4mQa",
  "externalId": "order_12345",
  "eventType": "PURCHASE",
  "revenueCents": 9900,
  "metadata": {
    "orderId": "order_12345"
  }
}
```

`externalId` should be unique per payable conversion within the campaign.
Sending the same `externalId` again for that campaign returns the existing lead
instead of creating a duplicate payout.

Percent-of-sale campaigns require `revenueCents` so AffiliateSwarm can compute
the payout from the campaign's `payoutPercentage`.

## Confirm Tracking

Campaigns receive a `testTrackingCode` at creation. Before activation, fire a
normal postback with `swarm_ref` set to that test code. AffiliateSwarm marks the
campaign as tracking-confirmed, returns a synthetic test `leadId`, creates no
real lead, and unlocks activation.
Do not use the synthetic test `leadId` with lead lookup or dispute endpoints.
