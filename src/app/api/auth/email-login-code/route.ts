import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendLoginCodeEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { ensureUserAccount, createLoginCode, checkIpRateLimit } from "@/lib/auth/login-code";

const EmailLoginCodeSchema = z.object({
  email: z
    .string()
    .email()
    .max(255)
    .transform((s) => s.toLowerCase().trim()),
});

/**
 * POST /api/auth/email-login-code
 *
 * Public endpoint (no auth). User enters their email on the login page
 * and receives a 6-character login code via email.
 *
 * Always returns success to avoid leaking whether an email is registered.
 * IP rate-limited: 5 requests per minute (DB-backed, works across instances).
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const allowed = checkIpRateLimit(ip, "/api/auth/email-login-code");
    if (!allowed) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please try again in a minute.",
        429
      );
    }

    const body = await req.json();
    const parsed = EmailLoginCodeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid email address", 400);
    }

    const { email } = parsed.data;

    // Always return success regardless of whether the email is found
    const successMsg = successResponse({
      message:
        "If an account with that email exists, a login code has been sent.",
    });

    // Look up agent by email
    const agent = await prisma.agent.findFirst({
      where: {
        email,
        deletedAt: null,
        status: "ACTIVE",
      },
    });

    if (!agent) {
      logger.info({ email }, "Email login code requested for unknown email");
      return successMsg;
    }

    const userId = await ensureUserAccount(agent);
    const code = await createLoginCode(agent.id, userId);

    // Await the send so failure is logged after the inline retries actually
    // exhaust (instead of fire-and-forget where the log might fire after the
    // function is killed). Still return the same generic success response on
    // failure to preserve enumeration protection — leaking "this email exists
    // because the failure path took longer / shaped differently" would defeat
    // the whole point of the always-200 contract above.
    try {
      await sendLoginCodeEmail(email, code, agent.displayName);
    } catch (err) {
      logger.error(
        { err, email, agentId: agent.id, action: "send_login_code_email" },
        "Failed to send login code email after retries"
      );
    }

    return successMsg;
  } catch (err) {
    logger.error({ err }, "Error in email-login-code endpoint");
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
