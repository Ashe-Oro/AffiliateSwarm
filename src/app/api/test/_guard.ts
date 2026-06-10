import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Shared gate for the test-only `/api/test/*` endpoints.
 *
 * These routes mint wallet balance, trigger payouts, and verify emails, so an
 * accidental production exposure is a direct path to theft. The gate is
 * fail-closed and defence-in-depth:
 *
 *  1. The `ENABLE_TEST_ROUTES` flag must be EXACTLY "1" or "true" (an
 *     allow-list, not a truthiness check — stray values like "false"/"0" no
 *     longer enable the routes).
 *  2. In production, the flag alone is never enough: the request must also
 *     carry an `x-test-secret` header that constant-time-matches the
 *     `TEST_ROUTES_SECRET` env var. If that secret is unset in production, the
 *     routes stay closed regardless of the flag.
 *
 * Outside production (local dev / CI dev server) the flag alone suffices, so
 * the common localhost test loop is unchanged.
 *
 * Returns a 404 `NextResponse` when the request must be rejected, or `null`
 * when the caller may proceed.
 */
export function assertTestRoutesEnabled(req: NextRequest): NextResponse | null {
  const notFound = NextResponse.json(
    { error: "Not available in production" },
    { status: 404 }
  );

  const flag = process.env.ENABLE_TEST_ROUTES;
  const flagEnabled = flag === "1" || flag === "true";
  if (!flagEnabled) return notFound;

  if (process.env.NODE_ENV === "production") {
    const secret = process.env.TEST_ROUTES_SECRET;
    const provided = req.headers.get("x-test-secret");
    if (!secret || !provided || !timingSafeEqualStr(provided, secret)) {
      return notFound;
    }
  }

  return null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; compare against a fixed-length
  // digest-free guard by short-circuiting on length without leaking via timing
  // of the secret contents.
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
