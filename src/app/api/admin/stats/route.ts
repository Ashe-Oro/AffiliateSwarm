import { NextRequest, NextResponse } from "next/server";
import { getAdminV1Stats } from "@/services/admin-stats.service";

function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("affiliateswarm_admin_token")?.value;
  const secret = process.env.ADMIN_SECRET;
  return !!(secret && token && token === secret);
}

/**
 * GET /api/admin/stats — Returns all V1 admin KPIs.
 *
 * Response: { data: AdminV1Stats }
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getAdminV1Stats();
  return NextResponse.json({ data: stats });
}
