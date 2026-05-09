import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  resendAgentVerificationEmail,
  resendOnboardingEmail,
} from "@/services/agent.service";

function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("affiliateswarm_admin_token")?.value;
  const secret = process.env.ADMIN_SECRET;
  return !!(secret && token && token === secret);
}

/**
 * PATCH /api/admin/agents — Suspend or activate an agent.
 * Body: { agentId, action: "SUSPEND" | "ACTIVATE" }
 */
export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, action } = await req.json();

  if (!agentId || !["SUSPEND", "ACTIVATE"].includes(action)) {
    return NextResponse.json(
      { error: "agentId and action (SUSPEND|ACTIVATE) required" },
      { status: 400 }
    );
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const newStatus = action === "SUSPEND" ? "SUSPENDED" : "ACTIVE";
  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: { status: newStatus },
  });

  return NextResponse.json({ ok: true, agent: { id: updated.id, status: updated.status } });
}

/**
 * POST /api/admin/agents — Resend a transactional email to an agent.
 * Body: { agentId, op?: "resend_verification" | "resend_onboarding" }
 *
 * `op` defaults to "resend_verification" for backwards compatibility with
 * existing admin clients.
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, op } = await req.json();
  const operation = op ?? "resend_verification";

  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  if (!["resend_verification", "resend_onboarding"].includes(operation)) {
    return NextResponse.json(
      {
        error:
          "op must be 'resend_verification' or 'resend_onboarding'",
      },
      { status: 400 }
    );
  }

  try {
    if (operation === "resend_onboarding") {
      const result = await resendOnboardingEmail(agentId);
      return NextResponse.json({
        ok: true,
        op: "resend_onboarding",
        email: result.email,
      });
    }

    const result = await resendAgentVerificationEmail(agentId);
    return NextResponse.json({
      ok: true,
      op: "resend_verification",
      email: result.email,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.details },
        { status: err.statusCode }
      );
    }

    console.error(`Admin ${operation} error:`, err);
    return NextResponse.json(
      { error: `Failed to ${operation.replace("_", " ")}` },
      { status: 500 }
    );
  }
}
