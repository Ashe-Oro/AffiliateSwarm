import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { ENABLE_PARTNER_PROGRAM } from "@/lib/feature-flags";

const CreatePartnerSchema = z.object({
  displayName: z.string().min(1).max(255),
  email: z.string().email().max(255),
  referralCode: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, "Referral code must be alphanumeric"),
  websiteUrl: z.string().url().max(2048).optional(),
  bio: z.string().max(2000).optional(),
  revenueShareBps: z.number().int().min(0).max(5000).optional(), // max 50%
});

/**
 * POST /api/v1/partners — Register as a AffiliateSwarm partner (public).
 */
export async function POST(req: NextRequest) {
  if (!ENABLE_PARTNER_PROGRAM()) {
    return errorResponse("NOT_FOUND", "Partner program is not currently available", 404);
  }
  try {
    const body = await req.json();
    const parsed = CreatePartnerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const data = parsed.data;

    // Check uniqueness
    const existing = await prisma.partner.findFirst({
      where: {
        OR: [
          { email: data.email },
          { referralCode: data.referralCode.toUpperCase() },
        ],
      },
    });

    if (existing) {
      return errorResponse(
        "CONFLICT",
        "Email or referral code is already taken",
        409
      );
    }

    const partner = await prisma.partner.create({
      data: {
        displayName: data.displayName,
        email: data.email,
        referralCode: data.referralCode.toUpperCase(),
        websiteUrl: data.websiteUrl,
        bio: data.bio,
        revenueShareBps: data.revenueShareBps ?? 1000, // default 10%
      },
    });

    return successResponse(
      {
        partner: {
          id: partner.id,
          displayName: partner.displayName,
          referralCode: partner.referralCode,
          revenueShareBps: partner.revenueShareBps,
          signupLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/partners/${partner.referralCode}`,
        },
      },
      201
    );
  } catch (error) {
    console.error("Partner registration error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to register partner", 500);
  }
}

/**
 * GET /api/v1/partners/:referralCode — Get partner info (public).
 */
export async function GET(req: NextRequest) {
  if (!ENABLE_PARTNER_PROGRAM()) {
    return errorResponse("NOT_FOUND", "Partner program is not currently available", 404);
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return errorResponse("VALIDATION_ERROR", "Missing code parameter", 400);
  }

  const partner = await prisma.partner.findUnique({
    where: { referralCode: code.toUpperCase(), active: true },
    select: {
      displayName: true,
      referralCode: true,
      bio: true,
      websiteUrl: true,
      _count: {
        select: { referredAgents: true },
      },
    },
  });

  if (!partner) {
    return errorResponse("NOT_FOUND", "Partner not found", 404);
  }

  return successResponse({ partner });
}
