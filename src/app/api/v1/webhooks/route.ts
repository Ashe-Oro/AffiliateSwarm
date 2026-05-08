import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { withAuth, getAuthContext } from "@/lib/auth";
import { RegisterWebhookSchema } from "@/lib/validators/webhook";
import { registerWebhook, listWebhooks } from "@/services/webhook.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/webhooks — Register a new webhook endpoint (authenticated).
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const body = await req.json();
    const parsed = RegisterWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid webhook data",
        400,
        parsed.error.issues
      );
    }

    const result = await registerWebhook(agent.id, parsed.data);

    return successResponse(result, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Webhook registration error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to register webhook", 500);
  }
});

/**
 * GET /api/v1/webhooks — List agent's webhook endpoints (authenticated).
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const webhooks = await listWebhooks(agent.id);

    return successResponse(webhooks);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("List webhooks error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list webhooks", 500);
  }
});
