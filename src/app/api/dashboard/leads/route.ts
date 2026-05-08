import { NextRequest } from "next/server";
import { requireAdvertiserAgent } from "@/lib/auth/dashboard";
import { errorResponse, paginatedResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import * as leadService from "@/services/lead.service";
import { ListLeadsSchema } from "@/lib/validators/lead";

export async function GET(req: NextRequest) {
  try {
    const { agent } = await requireAdvertiserAgent(req, {
      requireEmailVerified: true,
    });

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = ListLeadsSchema.safeParse(params);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        parsed.error.flatten()
      );
    }

    const result = await leadService.listLeads(
      parsed.data,
      agent.id,
      agent.type
    );

    return paginatedResponse(
      result.leads,
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
