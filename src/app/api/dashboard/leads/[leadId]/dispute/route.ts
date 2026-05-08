import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as leadService from "@/services/lead.service";
import { DisputeLeadSchema } from "@/lib/validators/lead";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });
    const { leadId } = await params;

    const body = await req.json();
    const parsed = DisputeLeadSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid dispute data",
        400,
        parsed.error.flatten()
      );
    }

    const lead = await leadService.disputeLead(
      leadId,
      agent.id,
      parsed.data.reason
    );

    return successResponse(lead);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    throw err;
  }
}
