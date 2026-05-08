import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOnboardingEmailWithTracking } from "@/services/agent.service";

function htmlResponse(title: string, message: string, status: number) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}
.card{background:#fff;border-radius:8px;padding:2rem 3rem;box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;max-width:480px}
h1{margin:0 0 .5rem;font-size:1.5rem}p{color:#555;margin:0}</style>
</head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * GET /api/v1/agents/:agentId/verify-email?token=TOKEN
 *
 * Click-through email verification link. No auth required — the token IS the
 * authentication.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const token = new URL(req.url).searchParams.get("token");

    if (!token) {
      return htmlResponse(
        "Invalid Link",
        "The verification link is missing the required token.",
        400
      );
    }

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, deletedAt: null },
    });

    if (!agent) {
      return htmlResponse("Not Found", "Agent not found.", 404);
    }

    if (agent.verificationLevel !== "UNVERIFIED") {
      return htmlResponse(
        "Already Verified",
        "This email address has already been verified.",
        200
      );
    }

    if (!agent.emailVerifyToken) {
      return htmlResponse(
        "Invalid Link",
        "No pending email verification for this agent.",
        400
      );
    }

    if (agent.emailVerifyToken !== token) {
      return htmlResponse(
        "Invalid Token",
        "The verification token is invalid.",
        400
      );
    }

    if (
      agent.emailVerifyTokenExpiresAt &&
      agent.emailVerifyTokenExpiresAt < new Date()
    ) {
      return htmlResponse(
        "Link Expired",
        "The verification link has expired. Please request a new one.",
        400
      );
    }

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        verificationLevel: "EMAIL_VERIFIED",
        emailVerifyToken: null,
        emailVerifyTokenExpiresAt: null,
      },
    });

    // Send onboarding/welcome email asynchronously — don't block the success
    // page render. Outcome is persisted to the agent row by the helper, so
    // admins can see when it failed and the agent (or admin) can request a
    // resend via the dashboard / admin UI.
    void sendOnboardingEmailWithTracking(agentId);

    return htmlResponse(
      "Email Verified Successfully",
      "Your email has been verified. You can close this page.",
      200
    );
  } catch (err) {
    console.error("Email verification error:", err);
    return htmlResponse(
      "Something Went Wrong",
      "An unexpected error occurred. Please try again later.",
      500
    );
  }
}
