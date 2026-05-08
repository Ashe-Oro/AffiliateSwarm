import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as leadService from "@/services/lead.service";
import { VerifyLeadSchema } from "@/lib/validators/lead";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });
    const { leadId } = await params;

    let data;
    try {
      const body = await req.json();
      const parsed = VerifyLeadSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid verify data",
          400,
          parsed.error.flatten()
        );
      }
      data = parsed.data;
    } catch {
      // Body is optional for verify
      data = undefined;
    }

    const lead = await leadService.verifyLead(leadId, agent.id, data);

    return successResponse(lead);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
