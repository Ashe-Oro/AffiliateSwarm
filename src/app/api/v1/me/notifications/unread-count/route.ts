import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, withRateLimit } from "@/lib/auth";
import { getUnreadCount } from "@/services/notification-feed.service";
import { AppError } from "@/lib/errors";

/**
 * GET /api/v1/me/notifications/unread-count — Get unread notification count.
 */
async function handler(req: NextRequest) {
  try {
    const { agent } = getAuthContext(req);
    const unreadCount = await getUnreadCount(agent.id);
    return successResponse({ unreadCount });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Unread count error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to get unread count",
      500
    );
  }
}

export const GET = withAuth(withRateLimit(handler));
