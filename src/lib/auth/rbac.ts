import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { getAuthContext } from "./middleware";
import { EmailNotVerifiedError } from "@/lib/errors";

/**
 * Roles map to `AgentType` in the Prisma schema, plus ADMIN and PLATFORM
 * which are checked via the agent's capabilities array.
 */
export type Role = "ADVERTISER" | "AFFILIATE" | "ADMIN" | "PLATFORM";

/**
 * Verify the authenticated agent has a verified email.
 * Must be applied *after* `withAuth`.
 */
export function requireEmailVerified(): (
  handler: RouteHandler
) => RouteHandler {
  return (handler) => {
    return async (req, ctx) => {
      const { agent } = getAuthContext(req);

      if (agent.verificationLevel === "UNVERIFIED") {
        const err = new EmailNotVerifiedError();
        return errorResponse(err.code, err.message, err.statusCode);
      }

      return handler(req, ctx);
    };
  };
}

type RouteHandler = (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Role-based access control middleware.
 *
 * Must be applied *after* `withAuth` so that `getAuthContext` is available.
 *
 * An agent satisfies the check if:
 * - Their `type` matches one of the required roles, OR
 * - Their `type` is `DUAL` and the required role is ADVERTISER or AFFILIATE, OR
 * - The required role is ADMIN/PLATFORM and the agent has the matching capability string.
 *
 * @param roles - One or more roles that are permitted to access the route.
 */
export function requireRole(
  ...roles: Role[]
): (handler: RouteHandler) => RouteHandler {
  return (handler) => {
    return async (req, ctx) => {
      const { agent } = getAuthContext(req);

      const hasRole = roles.some((role) => {
        // Direct type match
        if (agent.type === role) return true;

        // DUAL agents satisfy both ADVERTISER and AFFILIATE
        if (
          agent.type === "DUAL" &&
          (role === "ADVERTISER" || role === "AFFILIATE")
        ) {
          return true;
        }

        // ADMIN / PLATFORM are capability-based
        if (role === "ADMIN" || role === "PLATFORM") {
          return agent.capabilities.includes(role);
        }

        return false;
      });

      if (!hasRole) {
        return errorResponse(
          "FORBIDDEN",
          `This endpoint requires one of the following roles: ${roles.join(", ")}`,
          403
        );
      }

      return handler(req, ctx);
    };
  };
}
