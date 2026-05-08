import { randomBytes, createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import type { RegisterWebhookInput } from "@/lib/validators/webhook";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: unknown;
  signature: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function maskSecret(secret: string): string {
  return secret.slice(0, 8) + "*".repeat(secret.length - 8);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Webhook CRUD
// ---------------------------------------------------------------------------

export async function registerWebhook(
  agentId: string,
  input: RegisterWebhookInput
) {
  const secret = randomBytes(32).toString("hex");

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      agentId,
      url: input.url,
      events: input.events,
      secret,
    },
  });

  return {
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    secret, // returned once at creation time
    active: endpoint.active,
    createdAt: endpoint.createdAt,
  };
}

export async function listWebhooks(agentId: string) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });

  return endpoints.map((ep) => ({
    id: ep.id,
    url: ep.url,
    events: ep.events,
    secret: maskSecret(ep.secret),
    active: ep.active,
    createdAt: ep.createdAt,
    updatedAt: ep.updatedAt,
  }));
}

export async function deleteWebhook(agentId: string, webhookId: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: webhookId },
  });

  if (!endpoint) {
    throw new NotFoundError("WebhookEndpoint", webhookId);
  }

  if (endpoint.agentId !== agentId) {
    throw new ForbiddenError("You can only delete your own webhooks");
  }

  await prisma.webhookEndpoint.delete({ where: { id: webhookId } });

  return { message: "Webhook deleted successfully" };
}

// ---------------------------------------------------------------------------
// Event Delivery
// ---------------------------------------------------------------------------

const RETRY_DELAYS_MS = [1_000, 5_000, 25_000];

async function attemptDelivery(
  url: string,
  payload: WebhookPayload,
  attempt: number
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), // 10s timeout per attempt
    });
    return res.ok;
  } catch {
    console.error(
      `Webhook delivery attempt ${attempt + 1} failed for ${url}`
    );
    return false;
  }
}

async function deliverToEndpoint(
  url: string,
  secret: string,
  eventType: string,
  data: unknown
): Promise<void> {
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({ event: eventType, timestamp, data });
  const signature = signPayload(secret, body);

  const payload: WebhookPayload = {
    event: eventType,
    timestamp,
    data,
    signature,
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const success = await attemptDelivery(url, payload, attempt);
    if (success) return;

    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  console.error(
    `Webhook delivery failed after ${RETRY_DELAYS_MS.length + 1} attempts for ${url}`
  );
}

/**
 * Find all active endpoints subscribed to `eventType` and deliver the payload.
 * Fire-and-forget — does not block the caller.
 */
export function deliverEvent(eventType: string, data: unknown): void {
  // Fire-and-forget: run asynchronously without blocking
  void (async () => {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: {
          active: true,
          events: { has: eventType },
        },
      });

      if (endpoints.length === 0) return;

      // Deliver to all matching endpoints in parallel
      await Promise.allSettled(
        endpoints.map((ep) =>
          deliverToEndpoint(ep.url, ep.secret, eventType, data)
        )
      );
    } catch (err) {
      console.error("Webhook event delivery error:", err);
    }
  })();
}
