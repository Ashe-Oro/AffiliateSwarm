import { NextRequest, NextResponse } from "next/server";
import { TRACKING_PARAM } from "@/lib/brand";
import { trackClick } from "@/services/tracking.service";

type RouteContext = { params: Promise<{ trackingCode: string }> };

/**
 * GET /t/:trackingCode — Legacy redirect endpoint for click tracking.
 *
 * Disabled by default. Affiliates now share the advertiser's landing URL
 * directly with `?swarm_ref=<code>` appended (see buildTrackingUrl). The
 * redirect stays behind a flag so old links in the wild can be re-enabled
 * if needed.
 */
export async function GET(
  req: NextRequest,
  ctx: { params?: Promise<Record<string, string>> }
) {
  if (process.env.ENABLE_REDIRECT_TRACKING !== "true") {
    return NextResponse.json(
      {
        error:
          "Redirect tracking is disabled. Affiliate links now point directly to the advertiser with ?swarm_ref= appended.",
      },
      { status: 410 }
    );
  }

  const { trackingCode } = await (ctx as RouteContext).params;

  const result = await trackClick(trackingCode, {
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    referer: req.headers.get("referer") ?? undefined,
    geo: req.headers.get("x-vercel-ip-country") ?? undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: "Tracking link not found", code: result.error },
      { status: 404 }
    );
  }

  // Append ?swarm_ref=trackingCode to the landing URL
  const url = new URL(result.redirectUrl);
  url.searchParams.set(TRACKING_PARAM, trackingCode);

  return NextResponse.redirect(url.toString(), 302);
}
