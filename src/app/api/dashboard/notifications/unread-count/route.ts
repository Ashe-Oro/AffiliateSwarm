import { NextRequest } from "next/server";
import { getDashboardUser } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { getUnreadCount } from "@/services/notification-feed.service";

/**
 * GET /api/dashboard/notifications/unread-count — Unread notification count.
 */
export async function GET(req: NextRequest) {
  try {
    const { agents } = await getDashboardUser(req);
    const agentIds = agents.map((a) => a.id);
    const unreadCount = await getUnreadCount(agentIds);
    return successResponse({ unreadCount });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
