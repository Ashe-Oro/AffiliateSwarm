import { shopifyEnv } from "@/lib/shopify/env";

/**
 * Forwards a conversion to AffiliateSwarm's /api/v1/postback endpoint with
 * bounded retries on 5xx / network errors. 4xx responses are returned as
 * permanent failures (no retry).
 *
 * The caller (webhook handler) treats permanent failures as 200-to-Shopify
 * and transient failures as 500-to-Shopify so Shopify's own retry kicks in
 * as a second layer.
 */

export interface PostbackBody {
  swarm_ref: string;
  externalId: string;
  eventType: "PURCHASE";
  revenueCents: number;
  metadata?: Record<string, unknown>;
}

export type PostbackResult =
  | { status: "success"; leadId: string | null; attempts: number }
  | { status: "permanent_failure"; httpStatus: number; error: string; attempts: number }
  | { status: "transient_failure"; error: string; attempts: number };

const TIMEOUT_MS = 5_000;
const RETRY_BACKOFFS_MS = [200, 500];

interface SendOptions {
  /** Injected fetch for tests. */
  fetcher?: typeof fetch;
}

export async function sendPostback(
  apiKey: string,
  body: PostbackBody,
  opts: SendOptions = {},
): Promise<PostbackResult> {
  const fetcher = opts.fetcher ?? fetch;
  const url = `${shopifyEnv.affiliateswarmApiBase()}/api/v1/postback`;
  let attempts = 0;
  let lastError = "";

  for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
    attempts = attempt + 1;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

    try {
      const res = await fetcher(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const parsed = await safeParseJson(res);
        const leadId =
          (parsed?.data?.leadId as string | undefined) ??
          (parsed?.data?.id as string | undefined) ??
          null;
        return { status: "success", leadId, attempts };
      }

      if (res.status >= 400 && res.status < 500) {
        const errBody = await res.text();
        return {
          status: "permanent_failure",
          httpStatus: res.status,
          error: truncate(errBody, 500),
          attempts,
        };
      }

      lastError = `HTTP ${res.status}: ${truncate(await res.text(), 200)}`;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
    }

    const backoff = RETRY_BACKOFFS_MS[attempt];
    if (backoff != null) {
      await sleep(backoff);
    }
  }

  return { status: "transient_failure", error: lastError, attempts };
}

async function safeParseJson(res: Response): Promise<{ data?: Record<string, unknown> } | null> {
  try {
    return (await res.json()) as { data?: Record<string, unknown> };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
