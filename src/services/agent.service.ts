import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/auth";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors";
import { sendVerificationEmail, sendOnboardingEmail } from "@/lib/email";
import type { RegisterAgentInput, UpdateAgentInput, SearchAgentsInput } from "@/lib/validators/agent";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { API_KEY_PREFIX } from "@/lib/brand";
import {
  deriveAdvertiserWalletAddress,
  applyAdvertiserWalletInit,
} from "@/services/chain.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrationResult {
  agent: Awaited<ReturnType<typeof prisma.agent.create>>;
  apiKey: string;
  wallet: Awaited<ReturnType<typeof prisma.wallet.create>>;
  verificationEmailSent: boolean;
  verificationEmailError?: string;
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function createEmailVerificationToken() {
  return {
    token: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
}

// ---------------------------------------------------------------------------
// Email outcome tracking
// ---------------------------------------------------------------------------

type EmailKind = "verification" | "onboarding";
type EmailOutcome = { ok: true } | { ok: false; error: string };

/**
 * Persist the outcome of an email send attempt on the agent row. Best-effort:
 * a DB error here never throws — the caller's send path should not fail just
 * because we couldn't record the outcome.
 *
 * On success: sets `*SentAt` and `*LastAttemptAt` to now, clears `*LastError`.
 * On failure: sets `*LastAttemptAt` to now and `*LastError` to the message;
 * leaves `*SentAt` untouched (so it still reflects the most recent success).
 */
async function recordEmailOutcome(
  agentId: string,
  kind: EmailKind,
  outcome: EmailOutcome
): Promise<void> {
  const now = new Date();
  const data =
    kind === "verification"
      ? {
          verificationEmailLastAttemptAt: now,
          ...(outcome.ok
            ? { verificationEmailSentAt: now, verificationEmailLastError: null }
            : { verificationEmailLastError: outcome.error }),
        }
      : {
          onboardingEmailLastAttemptAt: now,
          ...(outcome.ok
            ? { onboardingEmailSentAt: now, onboardingEmailLastError: null }
            : { onboardingEmailLastError: outcome.error }),
        };
  try {
    await prisma.agent.update({ where: { id: agentId }, data });
  } catch (err) {
    logger.error(
      { err, agentId, kind, ok: outcome.ok },
      "Failed to record email outcome"
    );
  }
}

/** Public wrapper used by call sites outside this module that send the
 * verification email themselves (e.g. the auth signup route). */
export const recordVerificationEmailOutcome = (
  agentId: string,
  outcome: EmailOutcome
) => recordEmailOutcome(agentId, "verification", outcome);

// ---------------------------------------------------------------------------
// Agent CRUD
// ---------------------------------------------------------------------------

export async function registerAgent(
  data: RegisterAgentInput
): Promise<RegistrationResult> {
  // Check for duplicate display name (simple uniqueness guard)
  const existing = await prisma.agent.findFirst({
    where: { displayName: data.displayName, deletedAt: null },
  });
  if (existing) {
    throw new ConflictError(
      `An agent with display name '${data.displayName}' already exists`
    );
  }

  // Generate API key and HMAC secret
  const generatedKey = await generateApiKey();
  const hmacSecret = randomBytes(32).toString("hex");

  // If email provided, prepare verification token
  const emailVerification = data.email
    ? createEmailVerificationToken()
    : undefined;
  const emailVerifyToken = emailVerification?.token;
  const emailVerifyTokenExpiresAt = emailVerification?.expiresAt;

  // Pre-generate the agent id so we can derive the CDP deposit address with
  // the real id (CDP accounts are named by agentId and idempotent). Advertisers
  // get an auto-derived Base deposit address during registration so they can
  // fund immediately — CDP derivation happens outside the DB transaction
  // because it's a network call.
  const agentId = crypto.randomUUID();
  const advertiserWalletDerivation =
    data.type === "ADVERTISER"
      ? await deriveAdvertiserWalletAddress(agentId)
      : null;

  // Create agent, credential, wallet, and reputation in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: {
        id: agentId,
        type: data.type,
        displayName: data.displayName,
        ownerAccountId: data.ownerAccountId ?? crypto.randomUUID(),
        status: "ACTIVE",
        description: data.description,
        websiteUrl: data.websiteUrl,
        contactEndpoint: data.contactEndpoint,
        logoUrl: data.logoUrl,
        capabilities: data.capabilities ?? [],
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
        audienceSize: data.audienceSize,
        channels: data.channels ?? [],
        contentType: data.contentType,
        relevantUrls: data.relevantUrls ?? [],
        audienceGeo: data.audienceGeo,
        email: data.email,
        emailVerifyToken,
        emailVerifyTokenExpiresAt,
      },
    });

    await tx.apiCredential.create({
      data: {
        agentId: agent.id,
        apiKeyHash: generatedKey.hash,
        apiKeyPrefix: generatedKey.keyPrefix,
        hmacSecret,
        label: "Default API Key",
        scopes: ["*"],
      },
    });

    const createdWallet = await tx.wallet.create({
      data: { agentId: agent.id },
    });

    const wallet = advertiserWalletDerivation
      ? await applyAdvertiserWalletInit(
          createdWallet.id,
          advertiserWalletDerivation,
          tx
        )
      : createdWallet;

    await tx.agentReputation.create({
      data: { agentId: agent.id },
    });

    return { agent, wallet };
  });

  // Send verification email synchronously so failures are surfaced to the
  // caller. The retry helper in @/lib/email handles transient Resend errors.
  // If sending fails after retries we still return the agent — the row exists
  // and the caller can prompt a resend via the existing admin endpoint.
  let verificationEmailSent = false;
  let verificationEmailError: string | undefined;
  if (data.email && emailVerifyToken) {
    try {
      await sendVerificationEmail(data.email, emailVerifyToken, result.agent.id);
      await recordEmailOutcome(result.agent.id, "verification", { ok: true });
      verificationEmailSent = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      verificationEmailError = msg;
      await recordEmailOutcome(result.agent.id, "verification", {
        ok: false,
        error: msg,
      });
      logger.error(
        { err, agentId: result.agent.id, email: data.email, action: "send_verification_email" },
        "Failed to send verification email after retries"
      );
    }
  }

  return {
    agent: result.agent,
    apiKey: generatedKey.key,
    wallet: result.wallet,
    verificationEmailSent,
    verificationEmailError,
  };
}

export async function resendAgentVerificationEmail(
  agentId: string,
  options?: { fallbackEmail?: string }
) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
    select: {
      id: true,
      email: true,
      displayName: true,
      verificationLevel: true,
      ownerUser: {
        select: { email: true },
      },
    },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  if (agent.verificationLevel !== "UNVERIFIED") {
    throw new ConflictError("Email is already verified");
  }

  const email =
    agent.email ?? options?.fallbackEmail ?? agent.ownerUser?.email ?? null;

  if (!email) {
    throw new ValidationError(
      "No email address is available for this agent"
    );
  }

  const { token, expiresAt } = createEmailVerificationToken();

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      email,
      emailVerifyToken: token,
      emailVerifyTokenExpiresAt: expiresAt,
    },
  });

  try {
    await sendVerificationEmail(email, token, agentId);
    await recordEmailOutcome(agentId, "verification", { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await recordEmailOutcome(agentId, "verification", { ok: false, error: msg });
    throw err; // callers (admin/dashboard resend) expect throw on failure
  }

  return {
    email,
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Onboarding email — fired after email verification succeeds
// ---------------------------------------------------------------------------

/**
 * Send the onboarding/welcome email to a verified agent and persist the
 * outcome on the agent row. Never throws — onboarding is a non-blocking
 * side-effect of verification; the caller should `void` the returned promise
 * and move on. Failures are logged and surfaced via the `onboardingEmail*`
 * columns on the agent row for admin visibility and self-serve resend.
 */
export async function sendOnboardingEmailWithTracking(
  agentId: string
): Promise<void> {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
    select: { id: true, email: true, displayName: true, type: true },
  });
  if (!agent) {
    logger.warn({ agentId }, "Skipped onboarding email — agent not found");
    return;
  }
  if (!agent.email) {
    logger.warn({ agentId }, "Skipped onboarding email — no email on agent");
    return;
  }

  try {
    await sendOnboardingEmail(
      agent.email,
      agent.displayName,
      agent.type,
      agent.id
    );
    await recordEmailOutcome(agentId, "onboarding", { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await recordEmailOutcome(agentId, "onboarding", { ok: false, error: msg });
    logger.error(
      { err, agentId, action: "send_onboarding_email" },
      "Failed to send onboarding email after retries"
    );
  }
}

/**
 * Self-serve / admin path for re-sending the onboarding email. Mirrors
 * `resendAgentVerificationEmail` — guards on verification status, throws on
 * hard errors, returns the email it sent to.
 */
export async function resendOnboardingEmail(agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
    select: {
      id: true,
      email: true,
      displayName: true,
      type: true,
      verificationLevel: true,
    },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  if (agent.verificationLevel === "UNVERIFIED") {
    throw new ConflictError(
      "Agent email must be verified before the onboarding email can be sent"
    );
  }

  if (!agent.email) {
    throw new ValidationError(
      "No email address is available for this agent"
    );
  }

  // sendOnboardingEmailWithTracking swallows Resend failures into the DB, but
  // the resend path needs to surface them to the caller so the UI can show a
  // red error toast. Call sendOnboardingEmail directly and record the outcome
  // ourselves so we can re-throw.
  try {
    await sendOnboardingEmail(agent.email, agent.displayName, agent.type, agent.id);
    await recordEmailOutcome(agentId, "onboarding", { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await recordEmailOutcome(agentId, "onboarding", { ok: false, error: msg });
    throw err;
  }

  return { email: agent.email };
}

// ---------------------------------------------------------------------------
// Email retry sweep — invoked by the /api/cron/email-retry-sweep cron job.
// Catches agents whose verification or onboarding email never landed (the
// inline retries in @/lib/email exhausted, or the request was killed before
// the fire-and-forget promise resolved).
// ---------------------------------------------------------------------------

const SWEEP_BATCH_LIMIT = 50;
const SWEEP_BACKOFF_MS = 5 * 60 * 1000;
// Resend's free tier caps at 5 req/s. 250ms between sends = 4 req/s max out
// of the sweep loop, leaving 1 req/s of headroom for organic signups.
// sendWithRetry now handles 429 as transient anyway — this is belt-and-braces.
const SWEEP_SEND_THROTTLE_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface SweepResult {
  found: number;     // candidates returned by the query
  retried: number;   // attempted to send
  succeeded: number;
  failed: number;
}

/**
 * Re-fire the verification email for any UNVERIFIED agent whose token is
 * still valid but whose `verificationEmailSentAt` is null. Re-uses the
 * EXISTING token rather than minting a fresh one — the signup flow already
 * created one with a 24h TTL and minting a new one mid-sweep would silently
 * invalidate any link the user is about to click.
 */
export async function sweepStaleVerificationEmails(): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - SWEEP_BACKOFF_MS);
  const candidates = await prisma.agent.findMany({
    where: {
      deletedAt: null,
      verificationLevel: "UNVERIFIED",
      email: { not: null },
      emailVerifyToken: { not: null },
      verificationEmailSentAt: null,
      OR: [
        { verificationEmailLastAttemptAt: null },
        { verificationEmailLastAttemptAt: { lt: cutoff } },
      ],
      AND: [
        {
          OR: [
            { emailVerifyTokenExpiresAt: null },
            { emailVerifyTokenExpiresAt: { gt: new Date() } },
          ],
        },
      ],
    },
    select: { id: true, email: true, emailVerifyToken: true },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH_LIMIT,
  });

  const result: SweepResult = {
    found: candidates.length,
    retried: 0,
    succeeded: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const agent = candidates[i];
    if (!agent.email || !agent.emailVerifyToken) continue;
    if (i > 0) await sleep(SWEEP_SEND_THROTTLE_MS);
    result.retried++;
    try {
      await sendVerificationEmail(agent.email, agent.emailVerifyToken, agent.id);
      await recordEmailOutcome(agent.id, "verification", { ok: true });
      result.succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordEmailOutcome(agent.id, "verification", { ok: false, error: msg });
      result.failed++;
    }
  }

  return result;
}

/**
 * Re-fire the onboarding email for any verified agent whose
 * `onboardingEmailSentAt` is null. Wraps `sendOnboardingEmailWithTracking`
 * (which never throws) and infers success/failure by inspecting the agent
 * row after the helper returns.
 */
export async function sweepStaleOnboardingEmails(): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - SWEEP_BACKOFF_MS);
  const candidates = await prisma.agent.findMany({
    where: {
      deletedAt: null,
      verificationLevel: { not: "UNVERIFIED" },
      email: { not: null },
      onboardingEmailSentAt: null,
      OR: [
        { onboardingEmailLastAttemptAt: null },
        { onboardingEmailLastAttemptAt: { lt: cutoff } },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: SWEEP_BATCH_LIMIT,
  });

  const result: SweepResult = {
    found: candidates.length,
    retried: 0,
    succeeded: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const agent = candidates[i];
    if (i > 0) await sleep(SWEEP_SEND_THROTTLE_MS);
    result.retried++;
    await sendOnboardingEmailWithTracking(agent.id);
    const after = await prisma.agent.findUnique({
      where: { id: agent.id },
      select: { onboardingEmailSentAt: true },
    });
    if (after?.onboardingEmailSentAt) {
      result.succeeded++;
    } else {
      result.failed++;
    }
  }

  return result;
}

export async function getAgent(agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
    include: {
      wallet: true,
      reputation: true,
    },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  return agent;
}

export async function updateAgent(
  agentId: string,
  requestingAgentId: string,
  data: UpdateAgentInput
) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  if (agent.id !== requestingAgentId) {
    throw new ForbiddenError("You can only update your own agent profile");
  }

  return prisma.agent.update({
    where: { id: agentId },
    data: {
      displayName: data.displayName,
      description: data.description,
      websiteUrl: data.websiteUrl,
      contactEndpoint: data.contactEndpoint,
      logoUrl: data.logoUrl,
      capabilities: data.capabilities,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
      audienceSize: data.audienceSize,
      channels: data.channels ?? undefined,
      contentType: data.contentType,
      relevantUrls: data.relevantUrls ?? undefined,
      audienceGeo: data.audienceGeo,
    },
  });
}

export async function deactivateAgent(
  agentId: string,
  requestingAgentId: string
) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  if (agent.id !== requestingAgentId) {
    throw new ForbiddenError("You can only deactivate your own agent profile");
  }

  return prisma.agent.update({
    where: { id: agentId },
    data: {
      status: "DEACTIVATED",
      deletedAt: new Date(),
    },
  });
}

export async function searchAgents(filters: SearchAgentsInput) {
  const where: Prisma.AgentWhereInput = {
    deletedAt: null,
  };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.query) {
    where.displayName = { contains: filters.query, mode: "insensitive" };
  }

  const [agents, totalCount] = await Promise.all([
    prisma.agent.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.agent.count({ where }),
  ]);

  return { agents, totalCount, page: filters.page, pageSize: filters.pageSize };
}

// ---------------------------------------------------------------------------
// API Key Management
// ---------------------------------------------------------------------------

export async function issueApiKey(agentId: string, label?: string, scopes?: string[]) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  const generatedKey = await generateApiKey();
  const hmacSecret = randomBytes(32).toString("hex");

  const credential = await prisma.apiCredential.create({
    data: {
      agentId,
      apiKeyHash: generatedKey.hash,
      apiKeyPrefix: generatedKey.keyPrefix,
      hmacSecret,
      label: label ?? "API Key",
      scopes: scopes && scopes.length > 0 ? scopes : ["*"],
    },
  });

  return {
    id: credential.id,
    key: generatedKey.key,
    keyPrefix: generatedKey.keyPrefix,
    label: credential.label,
    createdAt: credential.createdAt,
  };
}

export async function listApiKeys(agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  const credentials = await prisma.apiCredential.findMany({
    where: { agentId, status: "ACTIVE" },
    select: {
      id: true,
      apiKeyPrefix: true,
      label: true,
      scopes: true,
      rateLimitTier: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Mask the key prefix for display
  return credentials.map((c) => ({
    ...c,
    maskedKey: `${API_KEY_PREFIX}${c.apiKeyPrefix}${"*".repeat(24)}`,
  }));
}

export async function revokeApiKey(
  agentId: string,
  keyId: string,
  requestingAgentId: string
) {
  const credential = await prisma.apiCredential.findFirst({
    where: { id: keyId, agentId, status: "ACTIVE" },
  });

  if (!credential) {
    throw new NotFoundError("API key", keyId);
  }

  if (credential.agentId !== requestingAgentId) {
    throw new ForbiddenError("You can only revoke your own API keys");
  }

  return prisma.apiCredential.update({
    where: { id: keyId },
    data: { status: "REVOKED" },
  });
}
