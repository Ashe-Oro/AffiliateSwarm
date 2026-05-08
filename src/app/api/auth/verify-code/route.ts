import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { AgentType } from "@/generated/prisma/client";

const VerifyCodeSchema = z.object({
  code: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifyCodeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid code format", 400);
    }

    const { code } = parsed.data;

    const loginCode = await prisma.loginCode.findUnique({
      where: { code },
      include: { user: true },
    });

    if (!loginCode || loginCode.used || loginCode.expiresAt < new Date()) {
      return errorResponse(
        "AUTH_INVALID_CODE",
        "Invalid or expired login code",
        401
      );
    }

    // Mark as used
    await prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { used: true },
    });

    // Create session
    const token = await createSession(loginCode.userId);

    // Fetch agent types so the client can redirect to the correct dashboard
    const agents = await prisma.agent.findMany({
      where: { ownerUserId: loginCode.userId, deletedAt: null },
      select: { type: true },
    });
    const agentTypes: AgentType[] = agents.map((a) => a.type);
    const hasAdvertiser = agentTypes.some(
      (t) => t === "ADVERTISER" || t === "DUAL"
    );

    const response = successResponse({
      user: {
        id: loginCode.user.id,
        email: loginCode.user.email,
        displayName: loginCode.user.displayName,
      },
      redirectTo: hasAdvertiser ? "/dashboard" : "/affiliate",
    });

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch {
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
