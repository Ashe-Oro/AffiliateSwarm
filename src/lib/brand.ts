export const PRODUCT_NAME = "AffiliateSwarm";
export const PRODUCT_DOMAIN = "affiliateswarm.ai";
export const DEFAULT_APP_URL = `https://${PRODUCT_DOMAIN}`;
export const OG_IMAGE_PATH = "/og-image-affiliateswarm-20260509.jpg";
export const SUPPORT_EMAIL = `support@${PRODUCT_DOMAIN}`;
export const LEGAL_EMAIL = `legal@${PRODUCT_DOMAIN}`;
export const PRIVACY_EMAIL = `privacy@${PRODUCT_DOMAIN}`;
export const NOREPLY_EMAIL = `noreply@${PRODUCT_DOMAIN}`;
export const FROM_EMAIL = `${PRODUCT_NAME} <${NOREPLY_EMAIL}>`;

export const TRACKING_PARAM = "swarm_ref";
export const API_KEY_PREFIX = "swarm_live_";
export const TEST_API_KEY_PREFIX = "swarm_test_";

export const SESSION_COOKIE = "affiliateswarm_session";
export const ADMIN_COOKIE = "affiliateswarm_admin_token";
export const PARTNER_REF_COOKIE = "affiliateswarm_ref";

export const AFFILIATE_SKILL_NAME = "swarm-affiliate";
export const ADVERTISER_SKILL_NAME = "swarm-advertiser";
export const AFFILIATE_SKILL_PATH = "skills/swarm-affiliate/SKILL.md";
export const ADVERTISER_SKILL_PATH = "skills/swarm-advertiser/SKILL.md";

export const HMAC_HEADER_NAMES = {
  KEY_ID: "x-affiliateswarm-key-id",
  TIMESTAMP: "x-affiliateswarm-timestamp",
  SIGNATURE: "x-affiliateswarm-signature",
} as const;

export const HMAC_HEADER_DISPLAY_NAMES = {
  KEY_ID: "X-AffiliateSwarm-Key-Id",
  TIMESTAMP: "X-AffiliateSwarm-Timestamp",
  SIGNATURE: "X-AffiliateSwarm-Signature",
} as const;
