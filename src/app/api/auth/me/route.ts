import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const agents = await prisma.agent.findMany({
      where: { ownerUserId: session.userId, deletedAt: null },
      select: {
        id: true,
        type: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });

    return successResponse({
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
      },
      agents,
    });
  } catch (error) {
    console.error("Me endpoint error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
