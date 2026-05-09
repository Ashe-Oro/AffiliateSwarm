import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_APP_URL, PARTNER_REF_COOKIE } from "@/lib/brand";
import { ENABLE_PARTNER_PROGRAM } from "@/lib/feature-flags";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;

type RouteContext = { params: Promise<{ code: string }> };

/**
 * GET /r/:code — Referral redirect.
 *
 * Redirects to the homepage with ?ref= param and sets a 30-day cookie.
 * The skill.md URL with the ref is shown on the landing page so the
 * human can copy it and send to their agent.
 */
export async function GET(
  req: NextRequest,
  ctx: { params?: Promise<Record<string, string>> }
) {
  if (!ENABLE_PARTNER_PROGRAM()) {
    return NextResponse.redirect(new URL("/", APP_URL).toString(), 302);
  }
  const { code } = await (ctx as RouteContext).params;
  const upperCode = code.toUpperCase();

  const url = new URL("/", APP_URL);
  url.searchParams.set("ref", upperCode);

  const response = NextResponse.redirect(url.toString(), 302);

  // Set a cookie so the partner code persists across page navigations
  response.cookies.set(PARTNER_REF_COOKIE, upperCode, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}
