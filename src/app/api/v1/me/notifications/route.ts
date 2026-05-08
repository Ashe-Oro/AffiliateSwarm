import { NextRequest } from "next/server";
import { paginatedResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, withRateLimit } from "@/lib/auth";
import { listNotifications } from "@/services/notification-feed.service";
import { ListNotificationsSchema } from "@/lib/validators/notification";
import { AppError } from "@/lib/errors";

/**
 * GET /api/v1/me/notifications — List the authenticated agent's notifications.
 *
 * Query params:
 *   ?page=1&pageSize=20&read=true|false&category=LEADS&eventType=lead.verified
 */
async function handler(req: NextRequest) {
  try {
    const { agent } = getAuthContext(req);
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = ListNotificationsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await listNotifications(agent.id, parsed.data);

    return paginatedResponse(
      result.notifications,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("List notifications error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to list notifications",
      500
    );
  }
}

export const GET = withAuth(withRateLimit(handler));
