import { TRACKING_PARAM } from "@/lib/brand";

/**
 * Build the direct tracking URL that affiliates share.
 *
 * The affiliate's tracking code is appended as `?swarm_ref=<code>` on the
 * campaign's landing URL. If the campaign has a buyer coupon code, it is
 * also appended as `?promo=<code>` so the advertiser can auto-apply the
 * discount. Users land directly on the advertiser's site — no redirect
 * through AffiliateSwarm, no short URL.
 *
 * Example: buildTrackingUrl("https://venice.ai/signup", "7xKpQm2N")
 *   → "https://venice.ai/signup?swarm_ref=7xKpQm2N"
 *
 * Example: buildTrackingUrl("https://venice.ai/signup", "7xKpQm2N", "SWARM20")
 *   → "https://venice.ai/signup?swarm_ref=7xKpQm2N&promo=SWARM20"
 */
export function buildTrackingUrl(
  landingUrl: string | null | undefined,
  trackingCode: string,
  couponCode?: string | null
): string | null {
  if (!landingUrl) return null;
  try {
    const url = new URL(landingUrl);
    url.searchParams.set(TRACKING_PARAM, trackingCode);
    if (couponCode) {
      url.searchParams.set("promo", couponCode);
    }
    return url.toString();
  } catch {
    return null;
  }
}
