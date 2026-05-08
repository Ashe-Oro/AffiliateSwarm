import { NextRequest } from "next/server";
import { withAuth, getAuthContext } from "@/lib/auth/middleware";
import { withRateLimit } from "@/lib/auth/rate-limit";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendLoginCodeEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { ensureUserAccount, createLoginCode, CODE_TTL_MS } from "@/lib/auth/login-code";

/**
 * POST /api/v1/auth/email-login-code
 *
 * Agent-authenticated endpoint. Generates a login code and sends it
 * directly to the agent's email on file. The agent never sees the code.
 *
 * Rate-limited via the standard DB-backed rate limiter (FREE tier = 60/min).
 */
export const POST = withAuth(
  withRateLimit(async (req: NextRequest) => {
    const { agent } = getAuthContext(req);

    const email = agent.email;
    if (!email) {
      return errorResponse(
        "NO_EMAIL",
        "No email address on file for this agent. Update your agent profile with an email first.",
        400
      );
    }

    const userId = await ensureUserAccount(agent);
    const code = await createLoginCode(agent.id, userId);

    // Await the send and surface failure to the agent caller. Login codes
    // are 5-min ephemeral so there's no async retry path — fail loudly so
    // the agent can retry the request immediately. The unused LoginCode row
    // is harmless: it'll auto-expire and the next attempt creates a fresh
    // one.
    try {
      await sendLoginCodeEmail(email, code, agent.displayName);
    } catch (err) {
      logger.error(
        { err, email, agentId: agent.id, action: "send_login_code_email" },
        "Failed to send login code email after retries"
      );
      return errorResponse(
        "EMAIL_DELIVERY_FAILED",
        "Failed to deliver login code, please try again",
        503
      );
    }

    return successResponse({
      message: "Login code sent to the email address on file.",
      email: email.replace(/^(.{2})(.*)(@.*)$/, "$1***$3"), // mask email
      expiresInSeconds: CODE_TTL_MS / 1000,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
    });
  })
);
