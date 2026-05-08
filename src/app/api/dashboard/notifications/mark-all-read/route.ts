import { NextRequest } from "next/server";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { markAllRead } from "@/services/notification-feed.service";
import { MarkAllReadSchema } from "@/lib/validators/notification";

/**
 * POST /api/dashboard/notifications/mark-all-read — Mark all notifications as read.
 */
export async function POST(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);
    const agentIds = agents.map((a) => a.id);

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
        parsed.error.flatten()
      );
    }

    const updated = await markAllRead(agentIds, parsed.data?.before);
    return successResponse({ updated });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
