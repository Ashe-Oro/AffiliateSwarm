import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/test/verify-email — Test-only: verify an agent's email directly.
 * Only available when NODE_ENV !== "production".
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const { agentId } = await req.json();

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      verificationLevel: "EMAIL_VERIFIED",
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
