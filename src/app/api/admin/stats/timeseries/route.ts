import { NextRequest, NextResponse } from "next/server";
import {
  getAdminTimeseries,
  type TimeseriesPeriod,
} from "@/services/admin-stats.service";

function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("affiliateswarm_admin_token")?.value;
  const secret = process.env.ADMIN_SECRET;
  return !!(secret && token && token === secret);
}

const VALID_PERIODS = new Set<TimeseriesPeriod>(["7d", "30d", "90d", "all"]);

/**
 * GET /api/admin/stats/timeseries?period=30d — Platform growth timeseries.
 *
 * Returns daily counts for advertisers, affiliates, campaigns, leads, conversions.
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const period = (url.searchParams.get("period") ?? "30d") as TimeseriesPeriod;

  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json(
      { error: "Invalid period. Use: 7d, 30d, 90d, all" },
      { status: 400 },
    );
  }

  const data = await getAdminTimeseries(period);
  return NextResponse.json({ data });
}
