import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as agentService from "@/services/agent.service";

const CreateApiKeySchema = z.object({
  label: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req);

    const body = await req.json();
    const parsed = CreateApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid API key request",
        400
      );
    }

    const result = await agentService.issueApiKey(
      agent.id,
      parsed.data.label
    );

    return successResponse(
      {
        ...result,
        apiKey: result.key,
      },
      201
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
