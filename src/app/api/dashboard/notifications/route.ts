import { NextRequest } from "next/server";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { paginatedResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { listNotifications } from "@/services/notification-feed.service";
import { ListNotificationsSchema } from "@/lib/validators/notification";

/**
 * GET /api/dashboard/notifications — List notifications for the authenticated user.
 * Returns notifications across all of the user's agents.
 */
export async function GET(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);
    const agentIds = agents.map((a) => a.id);

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = ListNotificationsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.flatten()
      );
    }

    const result = await listNotifications(agentIds, parsed.data);

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
    throw err;
  }
}
