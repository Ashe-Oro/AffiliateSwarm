import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { SessionTokenError, verifySessionTokenFromHeader, type VerifiedSessionToken } from "./session-token";

/**
 * Helper for /shopify/admin/api/* routes. Verifies the App Bridge session
 * JWT on the request's Authorization header and either:
 *   - returns the verified token for the caller to use, or
 *   - returns a 401 NextResponse the route should pass back directly.
 */
export function requireSessionToken(req: NextRequest): VerifiedSessionToken | NextResponse {
  try {
    return verifySessionTokenFromHeader(req.headers.get("authorization"));
  } catch (err) {
    const reason = err instanceof SessionTokenError ? err.reason : "unknown";
    logger.warn({ reason, action: "shopify_admin_auth" }, "session token rejected");
    return NextResponse.json({ ok: false, error: `unauthorized: ${reason}` }, { status: 401 });
  }
}
