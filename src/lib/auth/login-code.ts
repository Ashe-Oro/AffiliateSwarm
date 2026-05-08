/**
 * Shared login code utilities — used by all login code endpoints.
 */
import { randomInt } from "crypto";
import { PRODUCT_DOMAIN } from "@/lib/brand";
import { prisma } from "@/lib/prisma";

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const CODE_LENGTH = 6;

export const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateLoginCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CHARSET[randomInt(CHARSET.length)]
  ).join("");
}

/**
 * Ensure an agent has a UserAccount. Creates one if missing.
 * Returns the userId.
 */
export async function ensureUserAccount(agent: {
  id: string;
  ownerUserId: string | null;
  email: string | null;
  displayName: string;
}): Promise<string> {
  if (agent.ownerUserId) return agent.ownerUserId;

  const user = await prisma.userAccount.create({
    data: {
      email: agent.email ?? `agent-${agent.id}@${PRODUCT_DOMAIN}`,
      passwordHash: `nologin-${crypto.randomUUID()}`,
      displayName: agent.displayName,
    },
  });

  await prisma.agent.update({
    where: { id: agent.id },
    data: { ownerUserId: user.id },
  });

  return user.id;
}

/**
 * Invalidate existing unused codes, generate a new one, and store it.
 * Returns the generated code.
 */
export async function createLoginCode(
  agentId: string,
  userId: string
): Promise<string> {
  // Invalidate existing unused codes
  await prisma.loginCode.updateMany({
    where: { agentId, used: false },
    data: { used: true },
  });

  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.loginCode.create({
    data: {
      code,
      userId,
      agentId,
      expiresAt,
    },
  });

  return code;
}

/**
 * In-memory IP rate limiter for public (unauthenticated) endpoints.
 *
 * Note: This resets on cold starts and doesn't share state across serverless
 * instances. Sufficient for launch; move to Redis or a dedicated DB table
 * (without FK constraints) if abuse becomes an issue at scale.
 */
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkIpRateLimit(
  ip: string,
  _endpoint: string,
  maxRequests: number = 5,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const key = `${_endpoint}:${ip}`;
  const bucket = ipBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) return false;

  bucket.count++;
  return true;
}
