import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { extractKeyPrefix, verifyApiKey } from "./api-keys";
import { HMAC_HEADERS, verifySignature } from "./hmac";
import type { Agent, ApiCredential } from "@/generated/prisma/client";

/**
 * Extended request context attached after authentication.
 */
export interface AuthContext {
  agent: Agent;
  credential: ApiCredential;
}

/** Key used to attach auth context to the request. */
const AUTH_CONTEXT = Symbol.for("regatta.auth");

/**
 * Retrieve the auth context previously attached by `withAuth`.
 */
export function getAuthContext(req: NextRequest): AuthContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req as any)[AUTH_CONTEXT] as AuthContext;
}

type RouteHandler = (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Authentication middleware wrapper for Next.js API route handlers.
 *
 * Supports two authentication methods:
 * 1. Bearer token: `Authorization: Bearer rgt_live_...`
 * 2. HMAC-SHA256: `X-Regatta-Key-Id`, `X-Regatta-Timestamp`, `X-Regatta-Signature`
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      const authContext = await authenticate(req);
      if (authContext instanceof NextResponse) {
        return authContext;
      }

      // Attach auth context to the request object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any)[AUTH_CONTEXT] = authContext;

      return handler(req, ctx);
    } catch (err) {
      logger.error({ err, method: req.method, url: req.url, action: "authenticate_request" }, "Authentication failed with unexpected error");
      return errorResponse("AUTH_ERROR", "Authentication failed", 401);
    }
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function authenticate(
  req: NextRequest
): Promise<AuthContext | NextResponse> {
  const keyId = req.headers.get(HMAC_HEADERS.KEY_ID);

  if (keyId) {
    return authenticateHmac(req, keyId);
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authenticateBearer(req, authHeader.slice(7));
  }

  return errorResponse(
    "AUTH_MISSING",
    "Provide an Authorization header or HMAC signature headers",
    401
  );
}

async function authenticateBearer(
  _req: NextRequest,
  rawKey: string
): Promise<AuthContext | NextResponse> {
  const prefix = extractKeyPrefix(rawKey);
  if (!prefix) {
    return errorResponse("AUTH_INVALID_KEY", "Malformed API key", 401);
  }

  const credential = await prisma.apiCredential.findFirst({
    where: {
      apiKeyPrefix: prefix,
      status: "ACTIVE",
    },
    include: { agent: true },
  });

  if (!credential) {
    return errorResponse("AUTH_INVALID_KEY", "Invalid API key", 401);
  }

  const valid = await verifyApiKey(rawKey, credential.apiKeyHash);
  if (!valid) {
    return errorResponse("AUTH_INVALID_KEY", "Invalid API key", 401);
  }

  // Check agent status
  if (credential.agent.status !== "ACTIVE") {
    return errorResponse(
      "AGENT_INACTIVE",
      `Agent is ${credential.agent.status.toLowerCase()}`,
      403
    );
  }

  // Touch lastUsedAt (fire-and-forget)
  prisma.apiCredential
    .update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => logger.warn({ err, credentialId: credential.id }, "Failed to update lastUsedAt"));

  return { agent: credential.agent, credential };
}

async function authenticateHmac(
  req: NextRequest,
  keyId: string
): Promise<AuthContext | NextResponse> {
  const timestamp = req.headers.get(HMAC_HEADERS.TIMESTAMP);
  const signature = req.headers.get(HMAC_HEADERS.SIGNATURE);

  if (!timestamp || !signature) {
    return errorResponse(
      "AUTH_MISSING_HEADERS",
      "Missing HMAC timestamp or signature header",
      401
    );
  }

  const credential = await prisma.apiCredential.findFirst({
    where: {
      apiKeyPrefix: keyId,
      status: "ACTIVE",
    },
    include: { agent: true },
  });

  if (!credential) {
    return errorResponse("AUTH_INVALID_KEY", "Invalid key ID", 401);
  }

  // Read the request body for signature verification
  const body = await req.text();

  const result = verifySignature({
    secret: credential.hmacSecret,
    method: req.method,
    path: new URL(req.url).pathname,
    timestamp,
    signature,
    body,
  });

  if (!result.valid) {
    return errorResponse(
      "AUTH_INVALID_SIGNATURE",
      result.reason ?? "Invalid signature",
      401
    );
  }

  // Check agent status
  if (credential.agent.status !== "ACTIVE") {
    return errorResponse(
      "AGENT_INACTIVE",
      `Agent is ${credential.agent.status.toLowerCase()}`,
      403
    );
  }

  // Touch lastUsedAt (fire-and-forget)
  prisma.apiCredential
    .update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => logger.warn({ err, credentialId: credential.id }, "Failed to update lastUsedAt"));

  return { agent: credential.agent, credential };
}
