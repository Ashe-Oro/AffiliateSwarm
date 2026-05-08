import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext, withRateLimit } from "@/lib/auth";
import { markAllRead } from "@/services/notification-feed.service";
import { MarkAllReadSchema } from "@/lib/validators/notification";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/me/notifications/mark-all-read — Mark all notifications as read.
 *
 * Optional body: { before: "2026-04-10T..." }
 */
async function handler(req: NextRequest) {
  try {
    const { agent } = getAuthContext(req);

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is valid
    }

    const parsed = MarkAllReadSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        parsed.error.issues
      );
    }

    const updated = await markAllRead(agent.id, parsed.data?.before);
    return successResponse({ updated });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Mark all notifications read error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to mark notifications as read",
      500
    );
  }
}

export const POST = withAuth(withRateLimit(handler));
