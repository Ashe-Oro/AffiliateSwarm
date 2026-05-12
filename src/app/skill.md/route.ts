import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /skill.md — Redirect to the affiliate skill file (default).
 *
 * Role-specific skill files:
 *   /affiliate/skill.md
 *   /advertiser/skill.md
 */
export async function GET() {
  const target = new URL("/affiliate/skill.md", APP_URL);

  return NextResponse.redirect(target.toString(), 302);
}
