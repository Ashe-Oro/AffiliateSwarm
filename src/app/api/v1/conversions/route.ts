import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api-response";
import { withAuth, getAuthContext, requireEmailVerified } from "@/lib/auth";
import {
  SubmitConversionSchema,
  ListConversionsSchema,
} from "@/lib/validators/lead";
import { submitConversion, listConversions } from "@/services/lead.service";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/conversions — Submit a conversion event (authenticated).
 */
export const POST = withAuth(
  requireEmailVerified()(async (req: NextRequest) => {
  try {
    const { agent } = getAuthContext(req);
    const body = await req.json();
    const parsed = SubmitConversionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid conversion data",
        400,
        parsed.error.issues
      );
    }

    const conversion = await submitConversion(agent.id, parsed.data);

    return successResponse(
      {
        id: conversion.id,
        leadId: conversion.leadId,
        campaignId: conversion.campaignId,
        affiliateId: conversion.affiliateId,
        actionType: conversion.actionType,
        status: conversion.status,
        revenueCents: conversion.revenueCents,
        payoutCents: conversion.payoutCents,
        currency: conversion.currency,
        occurredAt: conversion.occurredAt,
        createdAt: conversion.createdAt,
      },
      201
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Conversion submission error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to submit conversion", 500);
  }
}));

/**
 * GET /api/v1/conversions — List conversions (authenticated).
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = ListConversionsSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid filter parameters",
        400,
        parsed.error.issues
      );
    }

    const result = await listConversions(parsed.data);

    return paginatedResponse(
      result.conversions,
      result.page,
      result.pageSize,
      result.totalCount
    );
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    console.error("Conversion list error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to list conversions", 500);
  }
});
