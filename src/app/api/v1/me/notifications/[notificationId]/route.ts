import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, withRateLimit } from "@/lib/auth";
import { markRead } from "@/services/notification-feed.service";
import { MarkReadSchema } from "@/lib/validators/notification";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ notificationId: string }> };

/**
 * PATCH /api/v1/me/notifications/:notificationId — Mark a notification as read.
 */
async function handler(
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) {
  try {
    const { agent } = getAuthContext(req);
    const { notificationId } = await (ctx as RouteContext).params;

    const body = await req.json();
    const parsed = MarkReadSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        parsed.error.issues
      );
    }

    const notification = await markRead(agent.id, notificationId);
    return successResponse(notification);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Mark notification read error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to mark notification as read",
      500
    );
  }
}

export const PATCH = withAuth(withRateLimit(handler));
