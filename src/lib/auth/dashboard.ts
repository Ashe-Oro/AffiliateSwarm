import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, EmailNotVerifiedError, ForbiddenError } from "@/lib/errors";
import { errorResponse } from "@/lib/api-response";
import {
  getSessionFromRequest,
  validateSession,
  SESSION_COOKIE,
} from "./session";
import type { UserAccount, Agent } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardUser {
  user: UserAccount;
  agents: Agent[];
}

export interface DashboardAuthResult extends DashboardUser {
  /** The ADVERTISER or DUAL agent that grants access to /dashboard. */
  advertiserAgent: Agent;
}

// ---------------------------------------------------------------------------
// For use in API routes
// ---------------------------------------------------------------------------

/**
 * Get the authenticated dashboard user from a request.
 * Throws AuthError if no valid session exists.
 */
export async function getDashboardUser(
  req: NextRequest
): Promise<DashboardUser> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    throw new AuthError("Authentication required");
  }

  const agents = await prisma.agent.findMany({
    where: { ownerUserId: session.userId, deletedAt: null },
  });

  return { user: session.user, agents };
}

/**
 * Get the authenticated dashboard user and validate they have an advertiser-capable agent.
 * Returns the first ADVERTISER or DUAL agent. Throws ForbiddenError if the user
 * only has AFFILIATE agents.
 */
export async function requireAdvertiserAgent(
  req: NextRequest,
  options?: { requireEmailVerified?: boolean }
): Promise<{ user: UserAccount; agent: Agent }> {
  const { user, agents } = await getDashboardUser(req);

  if (agents.length === 0) {
    throw new AuthError("No agent found");
  }

  const agent = agents.find(
    (a) => a.type === "ADVERTISER" || a.type === "DUAL"
  );

  if (!agent) {
    throw new ForbiddenError("Only advertiser agents can perform this action");
  }

  if (
    options?.requireEmailVerified &&
    agent.verificationLevel === "UNVERIFIED"
  ) {
    throw new EmailNotVerifiedError();
  }

  return { user, agent };
}

type DashboardRouteHandler = (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wrapper for API route handlers that require dashboard cookie-based auth.
 * On failure, returns a 401 JSON response.
 */
export function withDashboardAuth(
  handler: DashboardRouteHandler
): DashboardRouteHandler {
  return async (req, ctx) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return errorResponse("UNAUTHORIZED", "Authentication required", 401);
      }
      return handler(req, ctx);
    } catch {
      return errorResponse("AUTH_ERROR", "Authentication failed", 401);
    }
  };
}

// ---------------------------------------------------------------------------
// For use in React Server Components
// ---------------------------------------------------------------------------

/**
 * Validate the session in a server component context.
 * Redirects to /login if not authenticated. Returns user + agents on success.
 */
export async function requireDashboardAuth(): Promise<DashboardAuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/login");
  }

  const agents = await prisma.agent.findMany({
    where: { ownerUserId: session.userId, deletedAt: null },
  });

  const advertiserAgent = agents.find(
    (a) => a.type === "ADVERTISER" || a.type === "DUAL"
  );

  if (!advertiserAgent) {
    // Only redirect to /affiliate if the user actually has an affiliate agent.
    // If they have no agents at all, send them to onboarding to avoid a
    // /dashboard <-> /affiliate redirect loop.
    const hasAffiliateAgent = agents.some(
      (a) => a.type === "AFFILIATE" || a.type === "DUAL"
    );
    redirect(hasAffiliateAgent ? "/affiliate" : "/onboarding");
  }

  return { user: session.user, agents, advertiserAgent };
}
