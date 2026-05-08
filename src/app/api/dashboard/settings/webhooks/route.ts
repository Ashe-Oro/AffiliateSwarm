import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { RegisterWebhookSchema } from "@/lib/validators/webhook";
import {
  registerWebhook,
  listWebhooks,
} from "@/services/webhook.service";

export async function GET(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req);
    const webhooks = await listWebhooks(agent.id);
    return successResponse(webhooks);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req);

    const body = await req.json();
    const parsed = RegisterWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid webhook data",
        400
      );
    }

    const webhook = await registerWebhook(agent.id, parsed.data);

    return successResponse(webhook, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
