import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, EmailNotVerifiedError, ForbiddenError } from "@/lib/errors";
import { getSessionFromRequest, validateSession, SESSION_COOKIE } from "./session";
import type { UserAccount, Agent } from "@/generated/prisma/client";

export interface AffiliateDashboardUser {
  user: UserAccount;
  agent: Agent;
  agents: Agent[];
}

/**
 * Validate the session in a server component context for the affiliate dashboard.
 * Redirects to /login if not authenticated.
 * Returns the user + affiliate agent (AFFILIATE or DUAL type).
 */
export async function requireAffiliateDashboardAuth(): Promise<AffiliateDashboardUser> {
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

  const affiliateAgent = agents.find(
    (a) => a.type === "AFFILIATE" || a.type === "DUAL"
  );

  if (!affiliateAgent) {
    // Only redirect to /dashboard if the user has an advertiser agent.
    // If they have no agents at all, send them to onboarding to avoid a
    // /dashboard <-> /affiliate redirect loop.
    const hasAdvertiserAgent = agents.some(
      (a) => a.type === "ADVERTISER" || a.type === "DUAL"
    );
    redirect(hasAdvertiserAgent ? "/dashboard" : "/onboarding");
  }

  return { user: session.user, agent: affiliateAgent, agents };
}

// ---------------------------------------------------------------------------
// For use in API routes (throws errors instead of redirecting)
// ---------------------------------------------------------------------------

/**
 * Get the authenticated affiliate agent from a cookie-based API request.
 * Throws AuthError/ForbiddenError instead of redirecting.
 */
export async function requireAffiliateAgent(
  req: NextRequest,
  options?: { requireEmailVerified?: boolean }
): Promise<{ user: UserAccount; agent: Agent }> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    throw new AuthError("Authentication required");
  }

  const agents = await prisma.agent.findMany({
    where: { ownerUserId: session.userId, deletedAt: null },
  });

  const agent = agents.find(
    (a) => a.type === "AFFILIATE" || a.type === "DUAL"
  );

  if (!agent) {
    throw new ForbiddenError(
      "Only affiliate agents can perform this action"
    );
  }

  if (
    options?.requireEmailVerified &&
    agent.verificationLevel === "UNVERIFIED"
  ) {
    throw new EmailNotVerifiedError();
  }

  return { user: session.user, agent };
}
