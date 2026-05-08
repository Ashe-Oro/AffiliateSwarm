import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, withRateLimit } from "@/lib/auth";
import { listAffiliateApplications } from "@/services/campaign.service";
import { buildTrackingUrl } from "@/lib/tracking-url";
import { AppError } from "@/lib/errors";

/**
 * GET /api/v1/me/applications — List the authenticated agent's campaign applications.
 *
 * Optional query params:
 *   ?status=PENDING|APPROVED|REJECTED|REVOKED
 */
async function handler(req: NextRequest) {
  try {
    const { agent } = getAuthContext(req);

    const status = req.nextUrl.searchParams.get("status") ?? undefined;

    const enrollments = await listAffiliateApplications(agent.id, status);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applications = enrollments.map((e: any) => ({
      id: e.id,
      campaignId: e.campaign.id,
      campaignName: e.campaign.name,
      campaignStatus: e.campaign.status,
      status: e.status,
      trackingCode: e.trackingCode ?? null,
      ...(e.trackingCode && {
        trackingUrl: buildTrackingUrl(e.campaign.landingUrl, e.trackingCode, e.campaign.buyerCouponCode),
      }),
      pitch: e.pitch ?? null,
      enrolledAt: e.enrolledAt,
      approvedAt: e.approvedAt ?? null,
      rejectedAt: e.rejectedAt ?? null,
    }));

    return successResponse(applications);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("List affiliate applications error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to list applications",
      500
    );
  }
}

export const GET = withAuth(withRateLimit(handler));
