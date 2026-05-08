import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/session";
import { errorResponse, successResponse } from "@/lib/api-response";
import {
  deriveAdvertiserWalletAddress,
  applyAdvertiserWalletInit,
} from "@/services/chain.service";
import { sendVerificationEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import {
  createEmailVerificationToken,
  recordVerificationEmailOutcome,
} from "@/services/agent.service";

const TOS_VERSION = "2026-04-13";

// Creating an account implicitly accepts the Terms of Service and Privacy Policy.
// The signup surface must link to /terms and /privacy for this to be legally defensible.
const SignupSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Display name is required").max(255),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, password, displayName } = parsed.data;

    // Check if email is already taken
    const [existingUser, existingAgent] = await Promise.all([
      prisma.userAccount.findUnique({
        where: { email },
      }),
      prisma.agent.findFirst({
        where: { email },
      }),
    ]);

    if (existingUser || existingAgent) {
      return errorResponse("CONFLICT", "Email is already registered", 409);
    }

    const passwordHash = await hashPassword(password);
    const emailVerification = createEmailVerificationToken();

    // Pre-derive the CDP deposit address for the new advertiser. Signup is
    // always ADVERTISER; derivation must happen outside the DB transaction
    // because it's a network call.
    const agentId = crypto.randomUUID();
    const walletDerivation = await deriveAdvertiserWalletAddress(agentId);

    // Create user, agent, wallet, and reputation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.create({
        data: {
          email,
          passwordHash,
          displayName,
          tosAcceptedAt: new Date(),
          tosVersion: TOS_VERSION,
        },
      });

      const agent = await tx.agent.create({
        data: {
          id: agentId,
          type: "ADVERTISER",
          displayName,
          ownerAccountId: crypto.randomUUID(),
          ownerUserId: user.id,
          status: "ACTIVE",
          email,
          emailVerifyToken: emailVerification.token,
          emailVerifyTokenExpiresAt: emailVerification.expiresAt,
          capabilities: [],
        },
      });

      const createdWallet = await tx.wallet.create({
        data: { agentId: agent.id },
      });
      await applyAdvertiserWalletInit(createdWallet.id, walletDerivation, tx);

      await tx.agentReputation.create({
        data: { agentId: agent.id },
      });

      return { user, agent };
    });


    // Send verification email synchronously so failures are surfaced. The
    // retry helper handles transient Resend errors. On final failure we still
    // return 201 — the user account exists and they can request a resend via
    // the admin endpoint. The outcome is also persisted to the agent row so
    // admin/dashboard UI can show "last attempted / last error" without
    // grepping logs.
    let verificationEmailSent = false;
    let verificationEmailError: string | undefined;
    try {
      await sendVerificationEmail(
        email,
        emailVerification.token,
        result.agent.id
      );
      await recordVerificationEmailOutcome(result.agent.id, { ok: true });
      verificationEmailSent = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      verificationEmailError = msg;
      await recordVerificationEmailOutcome(result.agent.id, {
        ok: false,
        error: msg,
      });
      logger.error(
        { err, agentId: result.agent.id, email, action: "send_verification_email" },
        "Failed to send verification email after signup"
      );
    }

    // Create session
    const token = await createSession(result.user.id);

    // Build response with cookie
    const response = successResponse(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
        },
        agent: {
          id: result.agent.id,
          type: result.agent.type,
        },
        verificationEmailSent,
        ...(verificationEmailError && { verificationEmailError }),
      },
      201
    );

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
