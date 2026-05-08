import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import type { UserAccount } from "@/generated/prisma/client";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionData {
  userId: string;
  user: UserAccount;
}

/**
 * Create a new session for a user. Returns the raw token to be set as a cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.userSession.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

/**
 * Validate a session token. Returns the user if valid, null otherwise.
 */
export async function validateSession(
  token: string
): Promise<SessionData | null> {
  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Expired — clean up (fire-and-forget)
    prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    userId: session.userId,
    user: session.user,
  };
}

/**
 * Destroy a session by token.
 */
export async function destroySession(token: string): Promise<void> {
  await prisma.userSession
    .delete({ where: { token } })
    .catch(() => {});
}

/**
 * Extract and validate the session from a NextRequest's cookies.
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionData | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return validateSession(token);
}

export { SESSION_COOKIE, SESSION_DURATION_MS };
