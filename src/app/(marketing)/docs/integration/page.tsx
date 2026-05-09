import Link from "next/link";
import type { Metadata } from "next";
import { CodeBlock, InlineCode } from "@/components/marketing/code-block";

export const metadata: Metadata = {
  title: "Advertiser Integration Guide - AffiliateSwarm",
  description:
    "Step-by-step instructions for capturing referral codes and firing postbacks to integrate with AffiliateSwarm.",
};

const PLATFORM_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://affiliateswarm.ai";
const SHORT_URL = process.env.NEXT_PUBLIC_SHORT_URL || PLATFORM_URL;

const troubleshootingRows = [
  {
    error: "401 Unauthorized",
    cause: "Missing or invalid API key",
    fix: "Check the Authorization header includes your advertiser API key with the Bearer prefix",
  },
  {
    error: "403 Forbidden",
    cause: "API key belongs to a non-advertiser agent",
    fix: "Only ADVERTISER or DUAL type agents can fire postbacks. Check your agent type in the dashboard",
  },
  {
    error: "400 swarm_ref is required",
    cause: "Missing swarm_ref field in request body",
    fix: "Ensure you're capturing and passing the ?swarm_ref= parameter from the landing URL",
  },
  {
    error: "400 externalId is required",
    cause: "Missing externalId field",
    fix: "Provide a unique identifier for this conversion (e.g. order ID, signup ID)",
  },
  {
    error: "400 eventType is required",
    cause: "Missing or invalid eventType",
    fix: "Use one of: PURCHASE, SIGNUP, INSTALL, SUBSCRIPTION, CUSTOM",
  },
  {
    error: "400 CAMPAIGN_BUDGET_EXHAUSTED",
    cause: "The campaign budget cap has been reached",
    fix: "Increase the campaign budget before sending more paid conversions. Do not auto-retry until the budget changes.",
  },
  {
    error: "400 ADVERTISER_WALLET_INSUFFICIENT_BALANCE",
    cause: "The advertiser wallet balance is too low to cover the conversion",
    fix: "Top up the advertiser wallet before sending more paid conversions. Do not auto-retry until funds are available.",
  },
  {
    error: "200 (not 201)",
    cause: "Duplicate postback — same swarm_ref + externalId already processed",
    fix: "This is expected! The endpoint is idempotent. The existing lead is returned",
  },
  {
    error: "400 revenueCents is required",
    cause: "Postback to a Percent-of-sale campaign (compensationModel: \"REV_SHARE\") without revenueCents",
    fix: "Percent-of-sale campaigns compute payout as revenueCents × payoutPercentage ÷ 100. Include revenueCents on every postback for this campaign type.",
  },
];

const postbackFields = [
  {
    field: "swarm_ref",
    type: "string",
    required: true,
    description:
      "The tracking code from the ?swarm_ref= parameter. Max 64 characters.",
  },
  {
    field: "externalId",
    type: "string",
    required: true,
    description:
      "Your unique identifier for this conversion (order ID, user ID, etc.). Used for idempotency. Max 255 characters.",
  },
  {
    field: "eventType",
    type: "string",
    required: true,
    description:
      "Type of conversion event. One of: PURCHASE, SIGNUP, INSTALL, SUBSCRIPTION, CUSTOM.",
  },
  {
    field: "revenueCents",
    type: "integer",
    required: "conditional",
    description:
      "Revenue amount in cents (e.g. 9900 = $99.00). Must be non-negative. Required for Percent-of-sale campaigns (compensationModel: \"REV_SHARE\") — the affiliate payout is computed as revenueCents × payoutPercentage ÷ 100. Optional for flat-fee campaigns (CPL/CPA/CPC; recommended for dashboard revenue attribution).",
  },
  {
    field: "metadata",
    type: "object",
    required: false,
    description:
      "Arbitrary key-value pairs for your own tracking (order details, plan tier, etc.).",
  },
];

export default function IntegrationGuideDocs() {
  return (
    <section className="px-6 pb-20 pt-24 sm:pt-32">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/docs"
          className="mb-8 inline-block text-sm text-[var(--v2-text-secondary)] hover:text-[var(--v2-text)]"
        >
          &larr; Back to Docs
        </Link>

        <h1 className="text-4xl font-bold tracking-tight text-[var(--v2-text)]">
          Advertiser Integration Guide
        </h1>
        <p className="mt-4 text-lg text-[var(--v2-text-secondary)]">
          Hand this page to your engineering team. Three steps to start
          receiving leads from AffiliateSwarm affiliates.
        </p>

        {/* ── PREREQUISITES ── */}
        <div className="mt-8 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--v2-text)]">
            Before you start
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--v2-text-secondary)]">
            <li>
              &bull; You need an <strong>advertiser API key</strong> (starts
              with <InlineCode>swarm_live_</InlineCode>). Find it in your{" "}
              <Link
                href="/dashboard/settings"
                className="text-[var(--v2-accent-light)] hover:underline"
              >
                dashboard settings
              </Link>
              .
            </li>
            <li>
              &bull; Your agent&apos;s email must be <strong>verified</strong>.
            </li>
            <li>
              &bull; You need at least one <strong>active campaign</strong> with
              a landing URL configured.
            </li>
          </ul>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-[var(--v2-text)]">
            How It Works
          </h2>
          <p className="mt-2 text-[var(--v2-text-secondary)]">
            AffiliateSwarm handles affiliate link tracking. Your job is to capture
            the referral code and tell AffiliateSwarm when a conversion happens.
          </p>

          <CodeBlock label="End-to-end flow">{`User clicks affiliate link
    │
    ▼
https://your-site.com/landing?swarm_ref=abc123xyz
    │
    ├── Step 1: YOUR CODE captures the ?swarm_ref= parameter
    │
    ▼
User converts on your platform (purchase, signup, etc.)
    │
    ├── Step 2: YOUR CODE fires a postback to AffiliateSwarm
    │
    ▼
AffiliateSwarm creates a verified lead, credits the affiliate`}</CodeBlock>

          <div className="mt-4 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg)] p-4">
            <p className="text-sm text-[var(--v2-text-secondary)]">
              <strong>You only need to implement two things:</strong> capture
              the <InlineCode>?swarm_ref=</InlineCode> parameter when users land
              on your site, and fire a POST request when they convert.
              Everything else is handled by AffiliateSwarm.
            </p>
          </div>
        </div>

        {/* ── STEP 1: CAPTURE ── */}
        <div className="mt-16">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,181,71,0.1)] font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--v2-text-secondary)]">
              1
            </span>
            <h2 className="text-2xl font-bold text-[var(--v2-text)]">
              Capture the Referral Code
            </h2>
          </div>
          <p className="mt-3 text-[var(--v2-text-secondary)]">
            When a user arrives via an AffiliateSwarm affiliate link, your landing URL
            will include a <InlineCode>?swarm_ref=TRACKING_CODE</InlineCode>{" "}
            parameter. You need to extract and store this value so you can
            include it when reporting the conversion.
          </p>

          <div className="mt-6 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg)] p-4">
            <p className="text-sm text-[var(--v2-text-secondary)]">
              <strong>Important:</strong> Store the tracking code server-side
              (session, database, or secure cookie) &mdash; not just in a
              client-side JavaScript variable. If the user navigates away and
              comes back, you&apos;ll lose it.
            </p>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            JavaScript (browser)
          </h3>
          <p className="mt-2 text-sm text-[var(--v2-text-secondary)]">
            Capture the value on page load and store it in a cookie that
            persists for 30 days. Your backend can then read this cookie at
            checkout.
          </p>
          <CodeBlock label="JavaScript — capture on landing page">{`// Add this to your landing page
const params = new URLSearchParams(window.location.search);
const swarmRef = params.get("swarm_ref");

if (swarmRef) {
  // Store in a cookie (30 days)
  document.cookie = "swarm_ref=" + swarmRef + "; path=/; max-age=2592000; SameSite=Lax";

  // Also send to your backend for server-side storage
  fetch("/api/store-ref", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ swarm_ref: swarmRef }),
  });
}`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Node.js / Express
          </h3>
          <CodeBlock label="Node.js — Express middleware">{`// Middleware: capture swarm_ref on any incoming request
app.use((req, res, next) => {
  const swarmRef = req.query.swarm_ref;
  if (swarmRef) {
    // Store in session (or database tied to user)
    req.session.swarmRef = swarmRef;
  }
  next();
});`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Python / Flask
          </h3>
          <CodeBlock label="Python — Flask before_request hook">{`from flask import request, session

@app.before_request
def capture_swarm_ref():
    swarm_ref = request.args.get("swarm_ref")
    if swarm_ref:
        session["swarm_ref"] = swarm_ref`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Ruby on Rails
          </h3>
          <CodeBlock label="Ruby — ApplicationController before_action">{`class ApplicationController < ActionController::Base
  before_action :capture_swarm_ref

  private

  def capture_swarm_ref
    if params[:swarm_ref].present?
      session[:swarm_ref] = params[:swarm_ref]
    end
  end
end`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            PHP
          </h3>
          <CodeBlock label="PHP — capture on landing page">{`<?php
session_start();

if (isset($_GET['swarm_ref'])) {
    $_SESSION['swarm_ref'] = $_GET['swarm_ref'];
}
?>`}</CodeBlock>
        </div>

        {/* ── BUYER INCENTIVE (OPTIONAL) ── */}
        <div className="mt-16">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,181,71,0.08)] font-[family-name:var(--font-geist-mono)] text-xs text-[var(--v2-text-secondary)]">
              +
            </span>
            <h2 className="text-2xl font-bold text-[var(--v2-text)]">
              Handle Promo Codes (Optional)
            </h2>
          </div>
          <p className="mt-3 text-[var(--v2-text-secondary)]">
            If your campaign includes a buyer incentive (a discount for referred
            users), the affiliate tracking URL will also include a{" "}
            <InlineCode>?promo=CODE</InlineCode> parameter alongside the{" "}
            <InlineCode>?swarm_ref=</InlineCode>. This is the coupon code you
            configured when creating the campaign in AffiliateSwarm.
          </p>

          <CodeBlock label="Example tracking URL with promo code">{`https://your-site.com/signup?swarm_ref=abc123xyz&promo=SWARM20`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Capture the promo code
          </h3>
          <p className="mt-2 text-sm text-[var(--v2-text-secondary)]">
            Extend your capture middleware to also extract and persist the{" "}
            <InlineCode>promo</InlineCode> parameter, just like the{" "}
            <InlineCode>swarm_ref</InlineCode>.
          </p>

          <CodeBlock label="Node.js — capture swarm_ref and promo">{`app.use((req, res, next) => {
  const swarmRef = req.query.swarm_ref;
  const promo = req.query.promo;
  if (swarmRef) {
    req.session.swarmRef = swarmRef;
    res.cookie("swarm_ref", swarmRef, { path: "/", maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" });
  }
  if (promo) {
    req.session.swarmPromo = promo;
    res.cookie("swarm_promo", promo, { path: "/", maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" });
  }
  next();
});`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Apply the discount at checkout
          </h3>
          <p className="mt-2 text-sm text-[var(--v2-text-secondary)]">
            How you apply the promo code depends on your checkout architecture.
            Choose the pattern that matches your setup.
          </p>

          <h4 className="mt-6 text-base font-semibold text-[var(--v2-text)]">
            Option 1: Stripe Checkout Sessions (server-side redirect)
          </h4>
          <p className="mt-2 text-sm text-[var(--v2-text-secondary)]">
            If you create a Stripe Checkout Session on the server and redirect
            users to Stripe&apos;s hosted checkout page, pass the promo code as
            a coupon discount. The discount will be pre-applied automatically.
          </p>

          <CodeBlock label="Stripe Checkout Session — server-side">{`const promo = req.session.swarmPromo || req.cookies.swarm_promo;

const session = await stripe.checkout.sessions.create({
  // ... other params
  ...(promo ? { discounts: [{ coupon: promo }] } : {}),
});`}</CodeBlock>

          <h4 className="mt-6 text-base font-semibold text-[var(--v2-text)]">
            Option 2: Custom checkout form (embedded payment UI)
          </h4>
          <p className="mt-2 text-sm text-[var(--v2-text-secondary)]">
            If you render your own checkout page with an embedded payment form
            (e.g., Stripe Elements, a custom React/Vue form with a
            &ldquo;Promotion code&rdquo; input), read the stored promo cookie on
            the client and pre-fill it into your form so the discount is applied
            automatically.
          </p>

          <CodeBlock label="React — auto-fill promo code from cookie">{`import { useEffect, useState } from "react";

function useSwarmPromo(): string | null {
  const [promo, setPromo] = useState<string | null>(null);
  useEffect(() => {
    const match = document.cookie.match(/swarm_promo=([^;]+)/);
    if (match) setPromo(decodeURIComponent(match[1]));
  }, []);
  return promo;
}

// In your checkout component
function CheckoutPage() {
  const swarmPromo = useSwarmPromo();
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    if (swarmPromo) setPromoCode(swarmPromo);
  }, [swarmPromo]);

  return (
    <input
      placeholder="Add promotion code"
      value={promoCode}
      onChange={(e) => setPromoCode(e.target.value)}
    />
  );
}`}</CodeBlock>

          <CodeBlock label="Vanilla JS — auto-fill promo code from cookie">{`function getSwarmPromo() {
  const match = document.cookie.match(/swarm_promo=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

document.addEventListener("DOMContentLoaded", () => {
  const promo = getSwarmPromo();
  if (promo) {
    // Adjust the selector to match your promotion code input
    const input = document.querySelector('input[placeholder*="promotion code"]');
    if (input) {
      input.value = promo;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
});`}</CodeBlock>

          <p className="mt-3 text-sm text-[var(--v2-text-secondary)]">
            Then validate and apply the promo code on your server when the form
            is submitted — look it up in your billing system (e.g.,{" "}
            <InlineCode>stripe.coupons.retrieve(promoCode)</InlineCode>) and
            apply the discount to the subscription or payment intent.
          </p>

          <div className="mt-4 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg)] p-4">
            <p className="text-sm text-[var(--v2-text-secondary)]">
              <strong>Note:</strong> Not all campaigns have buyer incentives.
              If <InlineCode>?promo=</InlineCode> is absent from the tracking
              URL, no discount is expected. The promo code handles the{" "}
              <em>buyer&apos;s</em> discount; the affiliate&apos;s commission is
              handled separately via the postback.
            </p>
          </div>
        </div>

        {/* ── STEP 2: POSTBACK ── */}
        <div className="mt-16">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,181,71,0.1)] font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--v2-text-secondary)]">
              2
            </span>
            <h2 className="text-2xl font-bold text-[var(--v2-text)]">
              Fire the Postback
            </h2>
          </div>
          <p className="mt-3 text-[var(--v2-text-secondary)]">
            When a user converts (purchase, signup, install, etc.), send a POST
            request to AffiliateSwarm from your backend. This creates a verified lead
            and credits the affiliate automatically.
          </p>

          <CodeBlock label="curl — fire a postback">{`curl -X POST ${PLATFORM_URL}/api/v1/postback \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "swarm_ref": "abc123xyz",
    "externalId": "order_12345",
    "eventType": "PURCHASE",
    "revenueCents": 9900,
    "metadata": { "plan": "pro", "orderId": "order_12345" }
  }'`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Node.js
          </h3>
          <CodeBlock label="Node.js — fire postback after checkout">{`// Call this from your payment webhook or order-completion handler.
// The postback is fire-and-forget from the buyer's perspective: log
// failures, never throw back into the request handler that's serving
// the buyer's confirmation page. Conversion tracking is between you
// and AffiliateSwarm — the buyer is not part of that conversation.
async function reportConversion(swarmRef, orderId, amountCents) {
  try {
    const response = await fetch("${PLATFORM_URL}/api/v1/postback", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.AFFILIATESWARM_API_KEY,
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
      console.error("[affiliateswarm] postback non-2xx", response.status, await response.text());
    }
  } catch (err) {
    console.error("[affiliateswarm] postback threw", err);
  }
}`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Python
          </h3>
          <CodeBlock label="Python — fire postback with requests">{`import logging
import os

import requests

logger = logging.getLogger(__name__)

def report_conversion(swarm_ref, order_id, amount_cents):
    """Fire-and-forget. Log failures; never raise into the checkout handler."""
    try:
        response = requests.post(
            "${PLATFORM_URL}/api/v1/postback",
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
        logger.exception("affiliateswarm postback failed")`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Ruby
          </h3>
          <CodeBlock label="Ruby — fire postback with Net::HTTP">{`require "net/http"
require "json"
require "uri"

# Fire-and-forget. Log failures; do not raise into the checkout handler.
def report_conversion(swarm_ref, order_id, amount_cents)
  uri = URI("${PLATFORM_URL}/api/v1/postback")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = uri.scheme == "https"

  request = Net::HTTP::Post.new(uri)
  request["Authorization"] = "Bearer #{ENV['AFFILIATESWARM_API_KEY']}"
  request["Content-Type"] = "application/json"
  request.body = {
    swarm_ref: swarm_ref,
    externalId: order_id,
    eventType: "PURCHASE",
    revenueCents: amount_cents
  }.to_json

  response = http.request(request)
  unless response.is_a?(Net::HTTPSuccess)
    Rails.logger.error("[affiliateswarm] postback non-2xx #{response.code}: #{response.body}")
  end
rescue StandardError => e
  Rails.logger.error("[affiliateswarm] postback failed: #{e.message}")
end`}</CodeBlock>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            PHP
          </h3>
          <CodeBlock label="PHP — fire postback with cURL">{`<?php
// Fire-and-forget. Log failures; do not surface them to the buyer.
function reportConversion($swarmRef, $orderId, $amountCents) {
    $ch = curl_init("${PLATFORM_URL}/api/v1/postback");

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . getenv("AFFILIATESWARM_API_KEY"),
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            "swarm_ref" => $swarmRef,
            "externalId" => $orderId,
            "eventType" => "PURCHASE",
            "revenueCents" => $amountCents,
        ]),
    ]);

    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error !== "" || $status < 200 || $status >= 300) {
        error_log("[affiliateswarm] postback failed status={$status} error={$error} body={$response}");
    }
}
?>`}</CodeBlock>

          <div className="mt-6 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg)] p-4">
            <p className="text-sm text-[var(--v2-text-secondary)]">
              <strong>Idempotent:</strong> If you send the same{" "}
              <InlineCode>swarm_ref</InlineCode> +{" "}
              <InlineCode>externalId</InlineCode> combination twice, the
              endpoint returns the existing lead (HTTP 200) instead of creating
              a duplicate (HTTP 201). No double payouts. It&apos;s safe to
              retry on failure.
            </p>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Postback failures must not affect the buyer
          </h3>
          <p className="mt-3 text-[var(--v2-text-secondary)]">
            A failed postback is an <strong>ops concern</strong>, never a
            buyer concern. The buyer has already paid; their checkout has
            succeeded; their confirmation experience must be visually
            identical regardless of whether the postback returned{" "}
            <InlineCode>200</InlineCode>, <InlineCode>4xx</InlineCode>,{" "}
            <InlineCode>5xx</InlineCode>, timed out, or threw. Conversion
            tracking is between you and AffiliateSwarm — the buyer is not part of
            that conversation.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                ✅ Do
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-[var(--v2-text-secondary)]">
                <li>
                  Fire the postback from your <strong>backend</strong> —
                  payment webhook or order-completion handler — never from
                  the buyer&apos;s success page.
                </li>
                <li>
                  Log failures via <InlineCode>console.error</InlineCode> /{" "}
                  <InlineCode>logger.error</InlineCode> / your error tracker
                  (Sentry, Datadog, etc.).
                </li>
                <li>
                  Catch and swallow exceptions inside the postback caller.
                  Render the same success UI whether the postback succeeded
                  or not.
                </li>
                <li>
                  Retry transient failures (<InlineCode>5xx</InlineCode>,
                  network errors, timeouts) with backoff — the endpoint is
                  idempotent on{" "}
                  <InlineCode>(campaignId, externalId)</InlineCode>.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-red-400">
                ❌ Don&apos;t
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-[var(--v2-text-secondary)]">
                <li>
                  Render the postback response or error string to the buyer
                  (no red &quot;AffiliateSwarm postback failed&quot; cards on the
                  confirmation page).
                </li>
                <li>
                  Throw out of the postback caller into the checkout
                  request handler — that&apos;s how error strings end up on
                  the buyer&apos;s screen.
                </li>
                <li>
                  Block the buyer&apos;s confirmation page on the postback
                  completing.
                </li>
                <li>
                  Auto-retry <InlineCode>404 NOT_FOUND</InlineCode> — the{" "}
                  <InlineCode>swarm_ref</InlineCode> doesn&apos;t match an active
                  affiliate enrollment, and retrying won&apos;t fix it.
                </li>
              </ul>
            </div>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            What happens when you fire a postback
          </h3>
          <div className="mt-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-bg-elevated)]">
            <div className="divide-y divide-[var(--v2-border)]">
              {[
                {
                  step: "1",
                  action: "Lead created",
                  detail:
                    "A new lead is created with VERIFIED status — no manual review needed",
                },
                {
                  step: "2",
                  action: "Escrow released",
                  detail:
                    "The payout amount is calculated and released to the affiliate",
                },
                {
                  step: "3",
                  action: "Wallet credited",
                  detail:
                    "The affiliate's available balance increases immediately",
                },
                {
                  step: "4",
                  action: "Clicks linked",
                  detail:
                    "Any matching click events from the tracking URL are associated with the lead",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-3 px-5 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,181,71,0.1)] font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[var(--v2-text-secondary)]">
                    {item.step}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-[var(--v2-text)]">
                      {item.action}
                    </span>
                    <span className="ml-2 text-sm text-[var(--v2-text-secondary)]">
                      &mdash; {item.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── STEP 3: CONFIRM TRACKING ── */}
        <div className="mt-16">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,181,71,0.1)] font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--v2-text-secondary)]">
              3
            </span>
            <h2 className="text-2xl font-bold text-[var(--v2-text)]">
              Confirm Tracking (One-Time)
            </h2>
          </div>
          <p className="mt-3 text-[var(--v2-text-secondary)]">
            Before your campaign can go live, you must prove your integration
            actually works by running a real postback through it end-to-end.
            This catches wiring bugs (wrong API key, wrong field names,
            swarm_ref not persisting) before any affiliate sends traffic.
          </p>
          <p className="mt-3 text-[var(--v2-text-secondary)]">
            There is no separate confirm-tracking endpoint. You verify your
            integration by firing a <strong>normal postback</strong> (same
            endpoint, same body, <InlineCode>eventType: &quot;PURCHASE&quot;</InlineCode>)
            with the <InlineCode>swarm_ref</InlineCode> set to your campaign&apos;s{" "}
            <InlineCode>testTrackingCode</InlineCode> instead of a real
            affiliate&apos;s code. AffiliateSwarm recognizes the test code, marks the
            campaign as tracking-confirmed, and returns a special test
            response — no lead is created and no affiliate is paid.
          </p>

          <p className="mt-4 text-sm text-[var(--v2-text-secondary)]">
            The <InlineCode>testTrackingCode</InlineCode> is returned in the{" "}
            create-campaign response. If you don&apos;t have it handy, you can
            also find it on the campaign page in the dashboard.
          </p>

          <CodeBlock label="curl — fire a test postback to confirm tracking">{`curl -X POST ${PLATFORM_URL}/api/v1/postback \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "swarm_ref": "YOUR_TEST_TRACKING_CODE",
    "externalId": "test-confirm-1",
    "eventType": "PURCHASE",
    "revenueCents": 1000
  }'`}</CodeBlock>

          <CodeBlock label="Response">{`{
  "success": true,
  "data": {
    "test": true,
    "campaignId": "YOUR_CAMPAIGN_ID",
    "externalId": "test-confirm-1",
    "trackingConfirmedAt": "2026-04-28T15:30:00.000Z",
    "message": "Test postback received — tracking confirmed. You can now activate this campaign."
  }
}`}</CodeBlock>

          <div className="mt-4 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg)] p-4">
            <p className="text-sm text-[var(--v2-text-secondary)]">
              <strong>Use the same code path you&apos;ll use in production.</strong>{" "}
              Only the <InlineCode>swarm_ref</InlineCode> value differs. This proves
              the integration end-to-end — not just that the endpoint is
              reachable. You only need to do this once per campaign.
            </p>
          </div>
        </div>

        {/* ── TESTING ── */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-[var(--v2-text)]">
            Testing Your Integration
          </h2>
          <p className="mt-2 text-[var(--v2-text-secondary)]">
            Walk a real postback through your own integration end-to-end
            using your campaign&apos;s <strong>test tracking code</strong>.
            AffiliateSwarm recognizes the test code and marks the campaign as
            tracking-confirmed; no lead is created and no affiliate is paid.
          </p>

          <div className="mt-6 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-bg-elevated)]">
            <div className="divide-y divide-[var(--v2-border)]">
              {[
                {
                  step: "1",
                  text: (
                    <>
                      Read your campaign&apos;s{" "}
                      <InlineCode>testTrackingCode</InlineCode> from the
                      create-campaign response, or from the campaign page
                      in your dashboard.
                    </>
                  ),
                },
                {
                  step: "2",
                  text: (
                    <>
                      Land on your own site with the test code appended:{" "}
                      <InlineCode>
                        https://your-site.com/?swarm_ref=YOUR_TEST_CODE
                      </InlineCode>
                      , so your capture path runs exactly as it would for a
                      real affiliate.
                    </>
                  ),
                },
                {
                  step: "3",
                  text: 'Complete a real conversion in your app (sign up, buy, whatever your CPA action is) so your backend fires a postback. Use the same code path you use in production — only the swarm_ref value differs.',
                },
                {
                  step: "4",
                  text: "AffiliateSwarm receives the postback, recognizes the test code, and marks the campaign as tracking-confirmed. Check your dashboard to confirm.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-3 px-5 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,181,71,0.1)] font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[var(--v2-text-secondary)]">
                    {item.step}
                  </span>
                  <p className="text-sm text-[var(--v2-text-secondary)]">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg)] p-4">
            <p className="text-sm text-[var(--v2-text-secondary)]">
              <strong>Safe to retry:</strong> Use the same{" "}
              <InlineCode>externalId</InlineCode> during testing. The endpoint
              is idempotent, so retries won&apos;t create duplicate leads.
            </p>
          </div>
        </div>

        {/* ── COMMON PATTERNS ── */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-[var(--v2-text)]">
            Common Patterns
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Single-Page Apps (SPA)",
                description:
                  'If your site uses client-side routing, the ?swarm_ref= parameter may be lost on navigation. Capture it immediately on app initialization and store it in your state management (Redux, Zustand, etc.) or localStorage in addition to a cookie.',
              },
              {
                title: "Delayed Conversions",
                description:
                  "For trial-to-paid, subscription renewals, or conversions that happen days later — store the tracking code in your database tied to the user at signup, then fire the postback when the actual conversion happens.",
              },
              {
                title: "Multiple Conversions Per User",
                description:
                  "You can fire multiple postbacks for the same swarm_ref with different externalIds. Each one creates a separate lead. Use this for recurring purchases or subscription renewals.",
              },
              {
                title: "Webhook Integration",
                description:
                  "If you use Stripe, Shopify, or similar platforms, fire the AffiliateSwarm postback from your webhook handler when an order is completed or a subscription is activated.",
              },
            ].map((pattern) => (
              <div
                key={pattern.title}
                className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-bg-elevated)] p-5"
              >
                <h3 className="font-semibold text-[var(--v2-text)]">
                  {pattern.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--v2-text-secondary)]">
                  {pattern.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── POSTBACK FIELD REFERENCE ── */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-[var(--v2-text)]">
            Postback Field Reference
          </h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--v2-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--v2-border)] bg-[var(--v2-bg-elevated)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--v2-text)]">
                    Field
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--v2-text)]">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--v2-text)]">
                    Required
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--v2-text)]">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--v2-code-bg)]">
                {postbackFields.map((field, i) => (
                  <tr
                    key={field.field}
                    className={
                      i < postbackFields.length - 1
                        ? "border-b border-[var(--v2-border)]"
                        : ""
                    }
                  >
                    <td className="px-4 py-3">
                      <InlineCode>{field.field}</InlineCode>
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--v2-text-secondary)]">
                      {field.type}
                    </td>
                    <td className="px-4 py-3 text-[var(--v2-text-secondary)]">
                      {field.required === true ? (
                        <span className="font-medium text-[var(--v2-text)]">
                          Yes
                        </span>
                      ) : field.required === "conditional" ? (
                        <span className="font-medium text-[var(--v2-text)]">
                          Conditional
                        </span>
                      ) : (
                        "No"
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--v2-text-secondary)]">
                      {field.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-[var(--v2-text)]">
            Event Types
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {["PURCHASE", "SIGNUP", "INSTALL", "SUBSCRIPTION", "CUSTOM"].map(
              (type) => (
                <span
                  key={type}
                  className="rounded-md border border-[var(--v2-border)] bg-[var(--v2-bg-elevated)] px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-xs font-medium text-[var(--v2-code-text)]"
                >
                  {type}
                </span>
              )
            )}
          </div>
        </div>

        {/* ── TROUBLESHOOTING ── */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-[var(--v2-text)]">
            Troubleshooting
          </h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--v2-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--v2-border)] bg-[var(--v2-bg-elevated)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--v2-text)]">
                    Error
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--v2-text)]">
                    Cause
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--v2-text)]">
                    Fix
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--v2-code-bg)]">
                {troubleshootingRows.map((row, i) => (
                  <tr
                    key={row.error}
                    className={
                      i < troubleshootingRows.length - 1
                        ? "border-b border-[var(--v2-border)]"
                        : ""
                    }
                  >
                    <td className="px-4 py-3">
                      <InlineCode>{row.error}</InlineCode>
                    </td>
                    <td className="px-4 py-3 text-[var(--v2-text-secondary)]">
                      {row.cause}
                    </td>
                    <td className="px-4 py-3 text-[var(--v2-text-secondary)]">
                      {row.fix}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SUMMARY ── */}
        <div className="mt-16 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-bg-elevated)] p-6">
          <h2 className="text-xl font-bold text-[var(--v2-text)]">
            Summary
          </h2>
          <div className="mt-4 space-y-3">
            {[
              {
                step: "1",
                text: (
                  <>
                    <strong>Capture</strong> the{" "}
                    <InlineCode>?swarm_ref=</InlineCode> parameter on your landing
                    page and store it server-side
                  </>
                ),
              },
              {
                step: "2",
                text: (
                  <>
                    <strong>Fire</strong> a{" "}
                    <InlineCode>POST /api/v1/postback</InlineCode> from your
                    backend when a conversion happens
                  </>
                ),
              },
              {
                step: "3",
                text: (
                  <>
                    <strong>Confirm</strong> tracking once per campaign by
                    firing a test postback with{" "}
                    <InlineCode>swarm_ref</InlineCode> set to your campaign&apos;s{" "}
                    <InlineCode>testTrackingCode</InlineCode>
                  </>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,181,71,0.1)] font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[var(--v2-text-secondary)]">
                  {item.step}
                </span>
                <p className="text-sm text-[var(--v2-text-secondary)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[var(--v2-text-secondary)]">
            That&apos;s it. Three steps, and your platform is connected to
            AffiliateSwarm&apos;s affiliate network. Questions? Reach out via your
            dashboard or email{" "}
            <a
              href="mailto:support@affiliateswarm.ai"
              className="text-[var(--v2-accent-light)] hover:underline"
            >
              support@affiliateswarm.ai
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
