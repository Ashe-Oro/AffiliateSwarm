import { NextRequest } from "next/server";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { markRead } from "@/services/notification-feed.service";
import { MarkReadSchema } from "@/lib/validators/notification";

/**
 * PATCH /api/dashboard/notifications/:notificationId — Mark a notification as read.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { agents } = await getDashboardUser(req);
    const agentIds = agents.map((a) => a.id);
    const { notificationId } = await params;

    const body = await req.json();
    const parsed = MarkReadSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        parsed.error.flatten()
      );
    }

    const notification = await markRead(agentIds, notificationId);
    return successResponse(notification);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
