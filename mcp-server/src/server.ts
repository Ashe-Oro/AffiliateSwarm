import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// HTTP Client (zero dependencies — just fetch)
// ---------------------------------------------------------------------------

interface RegattaConfig {
  apiKey: string;
  apiUrl: string;
}

async function regattaRequest(
  config: RegattaConfig,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${config.apiUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (!response.ok) {
    const code = (json as Record<string, unknown>).code ?? "API_ERROR";
    const message = (json as Record<string, unknown>).message ?? response.statusText;
    throw new Error(`${code}: ${message}`);
  }

  return json;
}

// ---------------------------------------------------------------------------
// MCP Tool Response Helper
// ---------------------------------------------------------------------------

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function handleToolCall(fn: () => Promise<unknown>) {
  try {
    return toolResult(await fn());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolResult({ error: true, message });
  }
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

export function createRegattaMcpServer(config: RegattaConfig): McpServer {
  const server = new McpServer({
    name: "regatta",
    version: "0.1.0",
  });

  const api = {
    get: (path: string, query?: Record<string, string | number | undefined>) =>
      regattaRequest(config, "GET", path, undefined, query),
    post: (path: string, body?: unknown) =>
      regattaRequest(config, "POST", path, body),
  };

  // -----------------------------------------------------------------------
  // 1. discover_campaigns
  // -----------------------------------------------------------------------
  server.tool(
    "discover_campaigns",
    "Search for available affiliate campaigns to join. Returns active campaigns matching your filters.",
    {
      query: z.string().optional().describe("Free-text search on campaign name"),
      compensation_model: z
        .enum(["CPL", "CPA", "CPC", "REV_SHARE"])
        .optional()
        .describe("Filter by compensation model"),
      category: z.string().optional().describe("Filter by category tag"),
      geo: z.string().length(2).optional().describe("Filter by 2-letter geo code (e.g. US, GB)"),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    },
    async (params) =>
      handleToolCall(() =>
        api.get("/api/v1/discover/campaigns", {
          query: params.query,
          compensationModel: params.compensation_model,
          category: params.category,
          geo: params.geo,
          pageSize: params.limit,
        })
      )
  );

  // -----------------------------------------------------------------------
  // 2. apply_to_campaign
  // -----------------------------------------------------------------------
  server.tool(
    "apply_to_campaign",
    "Apply to join a campaign as an affiliate. For OPEN campaigns you are approved instantly; otherwise your application is reviewed.",
    {
      campaign_id: z.string().uuid().describe("Campaign ID to apply to"),
      pitch: z.string().max(5000).optional().describe("Optional pitch to the advertiser"),
    },
    async (params) =>
      handleToolCall(() =>
        api.post(`/api/v1/campaigns/${params.campaign_id}/applications`, {
          pitch: params.pitch,
        })
      )
  );

  // -----------------------------------------------------------------------
  // 3. submit_lead
  // -----------------------------------------------------------------------
  server.tool(
    "submit_lead",
    "Submit a lead to a campaign you are enrolled in. The lead goes through deduplication and fraud checks.",
    {
      campaign_id: z.string().uuid().describe("Campaign ID to submit the lead to"),
      tracking_code: z.string().max(64).optional().describe("Your tracking code"),
      external_id: z.string().max(255).optional().describe("Your external reference ID"),
      lead_data: z.record(z.string(), z.unknown()).optional().describe("Lead data / metadata"),
    },
    async (params) =>
      handleToolCall(() =>
        api.post("/api/v1/leads", {
          campaignId: params.campaign_id,
          trackingCode: params.tracking_code,
          externalId: params.external_id,
          leadData: params.lead_data,
        })
      )
  );

  // -----------------------------------------------------------------------
  // 4. create_campaign
  // -----------------------------------------------------------------------
  server.tool(
    "create_campaign",
    "Create a new campaign as an advertiser. Starts in DRAFT status — fund escrow then activate.",
    {
      name: z.string().min(1).max(255).describe("Campaign name"),
      description: z.string().max(5000).optional().describe("Campaign description"),
      compensation_model: z.enum(["CPL", "CPA", "CPC", "REV_SHARE"]).describe("How affiliates are paid"),
      payout_per_unit_cents: z.number().int().min(1).describe("Payout per unit in cents"),
      budget_cents: z.number().int().min(1).describe("Total budget in cents"),
      landing_url: z.string().url().optional().describe("Landing page URL"),
      geo_targets: z.array(z.string().length(2)).optional().describe("Target geos (2-letter codes)"),
      categories: z.array(z.string().max(100)).optional().describe("Category tags"),
      enrollment_policy: z.enum(["OPEN", "APPROVAL_REQUIRED", "INVITE_ONLY"]).optional().describe("How affiliates join"),
    },
    async (params) =>
      handleToolCall(() =>
        api.post("/api/v1/campaigns", {
          name: params.name,
          description: params.description,
          compensationModel: params.compensation_model,
          payoutPerUnitCents: params.payout_per_unit_cents,
          budgetCents: params.budget_cents,
          landingUrl: params.landing_url,
          currency: "USD",
          geoTargets: params.geo_targets,
          categories: params.categories,
          enrollmentPolicy: params.enrollment_policy ?? "APPROVAL_REQUIRED",
          requiresVerification: true,
        })
      )
  );

  // -----------------------------------------------------------------------
  // 5. activate_campaign
  // -----------------------------------------------------------------------
  server.tool(
    "activate_campaign",
    "Activate a DRAFT campaign after funding its escrow. Makes it visible to affiliates.",
    {
      campaign_id: z.string().uuid().describe("Campaign ID to activate"),
    },
    async (params) =>
      handleToolCall(() =>
        api.post(`/api/v1/campaigns/${params.campaign_id}/activate`)
      )
  );

  // -----------------------------------------------------------------------
  // 6. check_balance
  // -----------------------------------------------------------------------
  server.tool(
    "check_balance",
    "Check your wallet balance including available, held, and pending payout amounts.",
    {
      agent_id: z.string().uuid().describe("Your agent ID"),
    },
    async (params) =>
      handleToolCall(() => api.get(`/api/v1/wallets/${params.agent_id}`))
  );

  // -----------------------------------------------------------------------
  // 7. get_reputation
  // -----------------------------------------------------------------------
  server.tool(
    "get_reputation",
    "Get reputation profile for yourself or another agent. Returns trust tier, score, and dimension breakdowns.",
    {
      agent_id: z.string().uuid().describe("Agent ID to look up"),
    },
    async (params) =>
      handleToolCall(() => api.get(`/api/v1/reputation/${params.agent_id}`))
  );

  // -----------------------------------------------------------------------
  // 8. list_leads
  // -----------------------------------------------------------------------
  server.tool(
    "list_leads",
    "List leads you have submitted, with optional filters by campaign or status.",
    {
      campaign_id: z.string().uuid().optional().describe("Filter by campaign"),
      status: z
        .enum(["SUBMITTED", "PENDING_VERIFICATION", "VERIFIED", "REJECTED", "EXPIRED", "DISPUTED"])
        .optional()
        .describe("Filter by lead status"),
      page: z.number().int().min(1).optional().describe("Page number"),
      page_size: z.number().int().min(1).max(100).optional().describe("Results per page"),
    },
    async (params) =>
      handleToolCall(() =>
        api.get("/api/v1/leads", {
          campaignId: params.campaign_id,
          status: params.status,
          page: params.page,
          pageSize: params.page_size,
        })
      )
  );

  // -----------------------------------------------------------------------
  // 9. request_payout
  // -----------------------------------------------------------------------
  server.tool(
    "request_payout",
    "Request a payout of your available balance. Supports bank transfer (ACH), crypto (USDC on Base), or platform credit.",
    {
      amount_cents: z.number().int().min(100).describe("Payout amount in cents (min $1.00)"),
      method: z.enum(["BANK_TRANSFER", "CRYPTO", "PLATFORM_CREDIT"]).describe("Payout method"),
      stripe_account_id: z.string().optional().describe("Stripe account ID (for BANK_TRANSFER)"),
      chain_address: z.string().optional().describe("0x address on Base (for CRYPTO)"),
    },
    async (params) =>
      handleToolCall(() =>
        api.post("/api/v1/payouts", {
          amountCents: params.amount_cents,
          method: params.method,
          destination: {
            stripeAccountId: params.stripe_account_id,
            chainAddress: params.chain_address,
          },
        })
      )
  );

  return server;
}
