import { Resend } from "resend";
import { FROM_EMAIL, PRODUCT_NAME } from "@/lib/brand";
import { logger } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export const FROM = FROM_EMAIL;

// ---------------------------------------------------------------------------
// Retry helper for transient Resend failures
// ---------------------------------------------------------------------------

// Resend's SDK returns { data, error } where error.statusCode can be null
// (network/connectivity failure) or an HTTP status. We retry on:
//   - null        (network/connectivity)
//   - 5xx         (server-side transient)
//   - 429         (rate-limited — 5 req/s on the free tier, easily blown by
//                  the email-retry-sweep cron or concurrent signups)
// 4xx other than 429 is a caller error — retrying won't help.
export const RETRY_DELAYS_MS = [250, 1000, 4000]; // 3 retries → 4 total attempts
// 429 gets longer waits so we actually clear the rate-limit window.
export const RATE_LIMIT_RETRY_DELAYS_MS = [1000, 2500, 6000];

interface ResendError {
  name?: string;
  statusCode?: number | null;
  message?: string;
}

interface ResendResult<T> {
  data: T | null;
  error: ResendError | null;
}

export async function sendWithRetry<T>(
  fn: () => Promise<ResendResult<T>>,
  context: { operation: string; to: string }
): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const { data, error } = await fn();
    if (!error) return data as T;

    const status = error.statusCode ?? null;
    const isRateLimit = status === 429;
    const isTransient = status === null || isRateLimit || (status >= 500 && status < 600);

    if (!isTransient || attempt === RETRY_DELAYS_MS.length) {
      logger.error(
        { error, ...context, attempt },
        `Resend error: ${context.operation}`
      );
      throw new Error(`Failed to ${context.operation}`);
    }

    const delayMs = isRateLimit
      ? RATE_LIMIT_RETRY_DELAYS_MS[attempt]
      : RETRY_DELAYS_MS[attempt];
    logger.warn(
      { error, ...context, attempt, retryInMs: delayMs, rateLimited: isRateLimit },
      `Resend transient error, retrying: ${context.operation}`
    );
    await new Promise((r) => setTimeout(r, delayMs));
  }
  // Unreachable — loop either returns or throws — but keeps TS happy.
  throw new Error(`Failed to ${context.operation}`);
}

/**
 * Send an email-verification link to the given address.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  agentId: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/api/v1/agents/${agentId}/verify-email?token=${token}`;

  const resend = getResend();
  if (!resend) {
    logger.info({ to, verifyUrl }, "Verification email (dev mode — set RESEND_API_KEY)");
    return;
  }

  await sendWithRetry(
    () =>
      resend.emails.send({
        from: FROM,
        to,
        subject: "Verify your email address",
        html: `
<h2>Welcome to ${PRODUCT_NAME}</h2>

<h3>If you're a human</h3>
<p>Click the button below to verify your email address:</p>
<p><a href="${verifyUrl}" style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Verify Email</a></p>

<h3>If you're an AI agent</h3>
<p>Run this command to verify:</p>
<pre style="background: #f4f4f5; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; word-break: break-all;">curl "${verifyUrl}"</pre>

<p>Or construct the request from these values:</p>
<table style="font-family: monospace; font-size: 13px; border-collapse: collapse;">
<tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Agent ID</td><td>${agentId}</td></tr>
<tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Token</td><td>${token}</td></tr>
<tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Endpoint</td><td>GET /api/v1/agents/{agentId}/verify-email?token={token}</td></tr>
</table>

<p style="color: #71717a; font-size: 13px; margin-top: 16px;">This link expires in 24 hours.</p>
        `.trim(),
      }),
    { operation: "send verification email", to }
  );
}

/**
 * Send a login code to the user's email address.
 */
export async function sendLoginCodeEmail(
  to: string,
  code: string,
  displayName: string
): Promise<void> {
  const loginUrl = `${APP_URL}/login`;

  const resend = getResend();
  if (!resend) {
    logger.info({ to, code }, "Login code email (dev mode — set RESEND_API_KEY)");
    return;
  }

  await sendWithRetry(
    () =>
      resend.emails.send({
        from: FROM,
        to,
        subject: `Your ${PRODUCT_NAME} login code: ${code}`,
        html: `
<h2>Your login code</h2>
<p>Hi ${displayName}, here's your login code for ${PRODUCT_NAME}:</p>
<p style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 0.3em; background: #f4f4f5; padding: 16px 24px; border-radius: 8px; display: inline-block;">${code}</p>
<p>Enter it at <a href="${loginUrl}" style="font-weight: bold;">${loginUrl}</a></p>
<p style="color: #71717a; font-size: 13px;">This code expires in 5 minutes and can only be used once. If you didn't request this, you can safely ignore this email.</p>
        `.trim(),
      }),
    { operation: "send login code email", to }
  );
}

/**
 * Send an onboarding welcome email to new agents.
 */
export async function sendOnboardingEmail(
  to: string,
  displayName: string,
  agentType: "ADVERTISER" | "AFFILIATE" | "DUAL",
  agentId: string,
): Promise<void> {
  const skillUrl = agentType === "ADVERTISER"
    ? `${APP_URL}/advertiser/skill.md`
    : `${APP_URL}/affiliate/skill.md`;
  const loginUrl = `${APP_URL}/login`;

  const typeLabel =
    agentType === "DUAL"
      ? "advertiser and affiliate"
      : agentType.toLowerCase();

  const nextSteps =
    agentType === "ADVERTISER" || agentType === "DUAL"
      ? `
<li>Create a campaign — tell your agent: <em>Create a campaign on ${PRODUCT_NAME} for [your product]</em></li>
<li>Fund your campaign with card, ACH, or USDC</li>
<li>Activate it and watch affiliates start driving leads</li>`
      : `
<li>Discover campaigns — tell your agent: <em>Find campaigns on ${PRODUCT_NAME} that match our audience</em></li>
<li>Apply to the best ones and get your tracking links</li>
<li>Start earning commissions on every conversion</li>`;

  const resend = getResend();
  if (!resend) {
    logger.info({ to, agentId, agentType }, "Onboarding email (dev mode — set RESEND_API_KEY)");
    return;
  }

  await sendWithRetry(
    () =>
      resend.emails.send({
        from: FROM,
        to,
        subject: `Welcome to ${PRODUCT_NAME} — you're registered as ${typeLabel === "advertiser and affiliate" ? "an" : (/^[aeiou]/i.test(typeLabel) ? "an" : "a")} ${typeLabel}`,
        html: `
<h2>Welcome to ${PRODUCT_NAME}, ${displayName}</h2>
<p>You're registered as <strong>${typeLabel}</strong> on the agent-first affiliate marketplace.</p>

<h3>What's Next</h3>
<ol>
${nextSteps}
</ol>

<h3>Access Your Dashboard</h3>
<p>To sign in, tell your agent: <em>"Give me my ${PRODUCT_NAME} login code."</em> They'll generate a temporary 6-character code. Enter it at:</p>
<p><a href="${loginUrl}" style="font-weight: bold;">${loginUrl}</a></p>
<p style="color: #71717a; font-size: 13px;">Login codes expire after 5 minutes and are single-use. Ask your agent for a new one anytime.</p>
<h3>Your Agent's Cheat Sheet</h3>
<p>Your agent can always re-read the full instructions at:</p>
<p><a href="${skillUrl}" style="font-family: monospace;">${skillUrl}</a></p>

<p style="margin-top: 24px; color: #71717a; font-size: 13px;">
Questions? Reply to this email or visit <a href="${APP_URL}">${APP_URL}</a>
</p>
        `.trim(),
      }),
    { operation: "send onboarding email", to }
  );
}
