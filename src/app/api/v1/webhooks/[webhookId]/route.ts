import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { deleteWebhook } from "@/services/webhook.service";
import { AppError } from "@/lib/errors";

type RouteContext = { params: Promise<{ webhookId: string }> };

/**
 * DELETE /api/v1/webhooks/:webhookId — Delete a webhook endpoint (authenticated).
 */
export const DELETE = withAuth(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  try {
    const { webhookId } = await (ctx as RouteContext).params;
    const { agent } = getAuthContext(req);

    const result = await deleteWebhook(agent.id, webhookId);

    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Delete webhook error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to delete webhook", 500);
  }
});
