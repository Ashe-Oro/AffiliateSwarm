import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import type { RateLimitTier } from "@/generated/prisma/client";
import { getAuthContext } from "./middleware";

// ---------------------------------------------------------------------------
// Tier configuration: tokens per minute
// ---------------------------------------------------------------------------

const TIER_LIMITS: Record<RateLimitTier, number> = {
  FREE: 60,
  STANDARD: 300,
  ELEVATED: 600,
  PREMIUM: 1200,
  ENTERPRISE: 6000,
};

const WINDOW_MS = 60_000; // 1 minute window

// ---------------------------------------------------------------------------
// DB-backed sliding window rate limiter
// ---------------------------------------------------------------------------

async function consumeToken(
  agentId: string,
  credentialId: string,
  endpoint: string,
  maxTokens: number
): Promise<{ allowed: boolean; retryAfterMs: number; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  // Try to find an active bucket for this window
  const bucket = await prisma.rateLimitBucket.findFirst({
    where: {
      agentId,
      endpoint,
      windowStart: { gte: windowStart },
    },
    orderBy: { windowStart: "desc" },
  });

  if (bucket) {
    if (bucket.currentCount >= maxTokens) {
      const retryAfterMs = bucket.windowStart.getTime() + WINDOW_MS - now.getTime();
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000), remaining: 0 };
    }

    // Increment counter
    await prisma.rateLimitBucket.update({
      where: { id: bucket.id },
      data: { currentCount: { increment: 1 } },
    });

    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: maxTokens - bucket.currentCount - 1,
    };
  }

  // Create new bucket for this window
  await prisma.rateLimitBucket.create({
    data: {
      agentId,
      endpoint,
      windowStart: now,
      windowDurationMs: WINDOW_MS,
      maxRequests: maxTokens,
      currentCount: 1,
    },
  });

  // Clean up old buckets (fire-and-forget)
  prisma.rateLimitBucket
    .deleteMany({
      where: { agentId, endpoint, windowStart: { lt: windowStart } },
    })
    .catch(() => {});

  return { allowed: true, retryAfterMs: 0, remaining: maxTokens - 1 };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

type RouteHandler = (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Rate-limiting middleware wrapper using database-backed sliding window.
 *
 * Must be applied *after* `withAuth` so that `getAuthContext` is available.
 */
export function withRateLimit(handler: RouteHandler, tierOverride?: RateLimitTier): RouteHandler {
  return async (req, ctx) => {
    const auth = getAuthContext(req);
    const tier = tierOverride ?? auth.credential.rateLimitTier;
    const maxTokens = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;

    const endpoint = new URL(req.url).pathname;
    const { allowed, retryAfterMs, remaining } = await consumeToken(
      auth.agent.id,
      auth.credential.id,
      endpoint,
      maxTokens
    );

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      const res = errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Rate limit exceeded. Try again later.",
        429
      );
      res.headers.set("Retry-After", String(retryAfterSeconds));
      res.headers.set("X-RateLimit-Limit", String(maxTokens));
      res.headers.set("X-RateLimit-Remaining", "0");
      return res;
    }

    const response = await handler(req, ctx);

    response.headers.set("X-RateLimit-Limit", String(maxTokens));
    response.headers.set("X-RateLimit-Remaining", String(remaining));

    return response;
  };
}
