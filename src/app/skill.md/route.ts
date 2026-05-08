import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /skill.md — Redirect to the affiliate skill file (default).
 *
 * Preserves ?ref= query params for referral tracking.
 * The combined skill.md is deprecated in favor of role-specific files:
 *   /affiliate/skill.md
 *   /advertiser/skill.md
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");

  const target = new URL("/affiliate/skill.md", APP_URL);
  if (ref) {
    target.searchParams.set("ref", ref);
  }

  return NextResponse.redirect(target.toString(), 302);
}
