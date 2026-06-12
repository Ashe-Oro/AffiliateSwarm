import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTestRoutesEnabled } from "../_guard";

/**
 * POST /api/test/verify-email — Test-only: verify an agent's email directly.
 * Gated by assertTestRoutesEnabled (never reachable unauthenticated in prod).
 */
export async function POST(req: NextRequest) {
  const blocked = assertTestRoutesEnabled(req);
  if (blocked) return blocked;

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
