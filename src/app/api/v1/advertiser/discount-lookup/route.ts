import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  withAuth,
  getAuthContext,
  requireRole,
  requireEmailVerified,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/advertiser/discount-lookup?code=XYZ
 *
 * Looks up the tracking code (swarm_ref) of an active enrollment in an
 * active campaign owned by the calling advertiser whose `buyerCouponCode`
 * matches `code`. Used by the Shopify app when an order arrives with a
 * discount code but no cookie-based swarm_ref.
 *
 * Today's `buyerCouponCode` is campaign-level (one code per campaign), so
 * this returns the swarm_ref of the *earliest-approved enrollment* on the
 * matching campaign. Per-affiliate coupon codes are a separate v2 feature.
 */
export const GET = withAuth(
  requireRole("ADVERTISER")(
    requireEmailVerified()(async (req: NextRequest) => {
      const { agent } = getAuthContext(req);
      const code = req.nextUrl.searchParams.get("code")?.trim();

      if (!code || code.length > 100) {
        return errorResponse("VALIDATION_ERROR", "Missing or invalid code parameter", 400);
      }

      const campaign = await prisma.campaign.findFirst({
        where: {
          advertiserId: agent.id,
          status: "ACTIVE",
          buyerCouponCode: code,
        },
        select: { id: true },
      });

      if (!campaign) {
        return errorResponse("NOT_FOUND", "No active campaign matches this discount code", 404);
      }

      const enrollment = await prisma.affiliateEnrollment.findFirst({
        where: {
          campaignId: campaign.id,
          status: "APPROVED",
          trackingCode: { not: null },
        },
        orderBy: { approvedAt: "asc" },
        select: { trackingCode: true, affiliateId: true },
      });

      if (!enrollment?.trackingCode) {
        return errorResponse(
          "NOT_FOUND",
          "Campaign has no approved affiliate to attribute to",
          404,
        );
      }

      return successResponse({
        swarmRef: enrollment.trackingCode,
        campaignId: campaign.id,
        affiliateId: enrollment.affiliateId,
      });
    }),
  ),
);
