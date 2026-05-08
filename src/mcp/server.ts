import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import * as campaignService from "@/services/campaign.service";
import * as leadService from "@/services/lead.service";
import * as escrowService from "@/services/escrow.service";
import * as chainService from "@/services/chain.service";
import * as reputationService from "@/services/reputation.service";
import { prisma } from "@/lib/prisma";
import { AppError, EmailNotVerifiedError, NotFoundError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a service call so MCP tool handlers return structured results
 * and surface domain errors cleanly.
 */
async function handleToolCall<T>(
  fn: () => Promise<T>
): Promise<{ content: { type: "text"; text: string }[] }> {
  try {
    const result = await fn();
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: true,
                code: err.code,
                message: err.message,
                details: err.details,
              },
              null,
              2
            ),
          },
        ],
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: true, message }, null, 2),
        },
      ],
    };
  }
}

async function requireVerifiedAgentEmail(agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, deletedAt: null },
    select: { verificationLevel: true },
  });

  if (!agent) {
    throw new NotFoundError("Agent", agentId);
  }

  if (agent.verificationLevel === "UNVERIFIED") {
    throw new EmailNotVerifiedError();
  }
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Creates and returns the AffiliateSwarm MCP server with all tools registered.
 *
 * The `agentId` is the authenticated agent identity — in stdio mode it comes
 * from the AFFILIATESWARM_AGENT_ID env var; when embedded in an HTTP gateway it
 * would come from the auth middleware.
 */
export function createRegattaMcpServer(agentId: string): McpServer {
  const server = new McpServer({
    name: "regatta",
    version: "0.1.0",
  });

  // -----------------------------------------------------------------------
  // 1. discover_campaigns
  // -----------------------------------------------------------------------
  server.tool(
    "discover_campaigns",
    "Search for available affiliate campaigns to join. Returns active campaigns matching your filters.",
    {
      query: z
        .string()
        .optional()
        .describe("Free-text search on campaign name"),
      compensation_model: z
        .enum(["CPL", "CPA", "CPC", "REV_SHARE"])
        .optional()
        .describe("Filter by compensation model"),
      category: z.string().optional().describe("Filter by category tag"),
      geo: z
        .string()
        .length(2)
        .optional()
        .describe("Filter by 2-letter geo code (e.g. US, GB)"),
      min_payout_cents: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Minimum payout per unit in cents"),
      sort_by: z
        .enum(["payout", "newest"])
        .optional()
        .describe("Sort order for results"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max number of results (default 20)"),
    },
    async (params) => {
      return handleToolCall(async () => {
        await requireVerifiedAgentEmail(agentId);
        const result = await campaignService.discoverCampaigns({
          query: params.query,
          compensationModel: params.compensation_model,
          category: params.category,
          geo: params.geo,
          page: 1,
          pageSize: params.limit ?? 20,
        });

        // Post-filter by min_payout_cents if provided. REV_SHARE campaigns
        // have no fixed per-unit payout, so they always pass; downstream
        // consumers can decide how to display/rank them.
        let campaigns = result.campaigns;
        if (params.min_payout_cents !== undefined) {
          const minCents = params.min_payout_cents;
          campaigns = campaigns.filter(
            (c) =>
              c.compensationModel === "REV_SHARE" ||
              (c.payoutPerUnitCents ?? 0) >= minCents
          );
        }

        // Sort by payout — REV_SHARE campaigns (no fixed cents) sort last.
        if (params.sort_by === "payout") {
          campaigns.sort(
            (a, b) => (b.payoutPerUnitCents ?? 0) - (a.payoutPerUnitCents ?? 0)
          );
        }
        // Default (newest) is already the DB order

        return {
          campaigns,
          totalCount: result.totalCount,
        };
      });
    }
  );

  // -----------------------------------------------------------------------
  // 2. apply_to_campaign
  // -----------------------------------------------------------------------
  server.tool(
    "apply_to_campaign",
    "Apply to join a campaign as an affiliate. For OPEN campaigns you are approved instantly; otherwise your application is reviewed.",
    {
      campaign_id: z.string().uuid().describe("Campaign ID to apply to"),
      pitch: z
        .string()
        .max(5000)
        .optional()
        .describe("Optional pitch message to the advertiser"),
      estimated_monthly_volume: z
        .number()
        .int()
        .optional()
        .describe("Estimated monthly lead volume you can deliver"),
    },
    async (params) => {
      return handleToolCall(async () => {
        await requireVerifiedAgentEmail(agentId);
        const enrollment = await campaignService.applyToCampaign(
          params.campaign_id,
          agentId,
          {
            pitch: params.pitch,
            customTerms: params.estimated_monthly_volume
              ? { estimatedMonthlyVolume: params.estimated_monthly_volume }
              : undefined,
          }
        );
        return enrollment;
      });
    }
  );

  // -----------------------------------------------------------------------
  // 3. submit_lead
  // -----------------------------------------------------------------------
  server.tool(
    "submit_lead",
    "Submit a lead to a campaign you are enrolled in. The lead goes through deduplication and fraud checks before being accepted.",
    {
      campaign_id: z
        .string()
        .uuid()
        .describe("Campaign ID to submit the lead to"),
      tracking_code: z
        .string()
        .max(64)
        .optional()
        .describe("Your tracking code (defaults to enrollment tracking code)"),
      external_id: z
        .string()
        .max(255)
        .optional()
        .describe("Your external reference ID for this lead"),
      metadata: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Arbitrary lead data / metadata"),
    },
    async (params) => {
      return handleToolCall(async () => {
        await requireVerifiedAgentEmail(agentId);
        const lead = await leadService.submitLead(agentId, {
          campaignId: params.campaign_id,
          trackingCode: params.tracking_code,
          externalId: params.external_id,
          leadData: params.metadata,
        });
        return lead;
      });
    }
  );

  // -----------------------------------------------------------------------
  // 4. create_campaign
  // -----------------------------------------------------------------------
  server.tool(
    "create_campaign",
    "Create a new campaign as an advertiser. The campaign starts in DRAFT status and requires escrow funding before activation.",
    {
      name: z.string().min(1).max(255).describe("Campaign name"),
      description: z
        .string()
        .max(5000)
        .optional()
        .describe("Campaign description"),
      compensation_model: z
        .enum(["CPL", "CPA", "CPC", "REV_SHARE"])
        .describe("How affiliates are compensated"),
      payout_per_unit_cents: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(
          "Fixed payout per conversion in cents. Required for CPL/CPA/CPC; omit for REV_SHARE."
        ),
      payout_percentage: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe(
          "REV_SHARE only: integer percentage (1-100) of revenueCents to pay the affiliate per conversion. For 20% send 20."
        ),
      budget_cents: z
        .number()
        .int()
        .min(1)
        .describe("Total campaign budget in cents"),
      landing_url: z
        .string()
        .url()
        .max(2048)
        .optional()
        .describe("Landing page URL for the campaign"),
      currency: z
        .string()
        .length(3)
        .optional()
        .describe("3-letter currency code (default USD)"),
      geo_targets: z
        .array(z.string().length(2))
        .optional()
        .describe("Target geographies (2-letter codes)"),
      categories: z
        .array(z.string().max(100))
        .optional()
        .describe("Campaign category tags"),
      enrollment_policy: z
        .enum(["OPEN", "APPROVAL_REQUIRED", "INVITE_ONLY"])
        .optional()
        .describe("How affiliates join (default APPROVAL_REQUIRED)"),
      daily_cap_count: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Maximum leads per day"),
      daily_cap_cents: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Maximum spend per day in cents"),
    },
    async (params) => {
      return handleToolCall(async () => {
        await requireVerifiedAgentEmail(agentId);
        const result = await campaignService.createCampaign(agentId, {
          name: params.name,
          description: params.description,
          compensationModel: params.compensation_model,
          payoutPerUnitCents: params.payout_per_unit_cents,
          payoutPercentage: params.payout_percentage,
          budgetCents: params.budget_cents,
          landingUrl: params.landing_url,
          currency: params.currency ?? "USD",
          geoTargets: params.geo_targets,
          categories: params.categories,
          enrollmentPolicy: params.enrollment_policy ?? "APPROVAL_REQUIRED",
          dailyCapCount: params.daily_cap_count,
          dailyCapCents: params.daily_cap_cents,
          holdingPeriodDays: 30,
          requiresVerification: true,
        });
        return result;
      });
    }
  );

  // -----------------------------------------------------------------------
  // 5. check_balance
  // -----------------------------------------------------------------------
  server.tool(
    "check_balance",
    "Check your wallet balance including available, held, and pending payout amounts.",
    async () => {
      return handleToolCall(async () => {
        const wallet = await escrowService.getWallet(agentId);
        return wallet;
      });
    }
  );

  // -----------------------------------------------------------------------
  // 5c. submit_onchain_deposit
  // -----------------------------------------------------------------------
  server.tool(
    "submit_onchain_deposit",
    "Optional manual verification of a USDC-on-Base deposit by tx hash. Deposits sent to your depositAddress are normally detected and credited automatically within a few minutes of confirming on Base — no hash submission required. Call this tool only if you want to force immediate verification (e.g. auto-detection is delayed, or you want to confirm a specific transfer landed). Your campaigns auto-draw from this wallet balance as conversions come in, up to each campaign's budgetCents cap.",
    {
      tx_hash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe("The Base transaction hash of the USDC transfer"),
    },
    async (params) => {
      return handleToolCall(async () => {
        await requireVerifiedAgentEmail(agentId);
        const result = await chainService.processOnchainDeposit(
          agentId,
          params.tx_hash
        );
        return {
          chainTransactionId: result.chainTransaction.id,
          status: result.chainTransaction.status,
          amountCents: result.chainTransaction.amountCents,
          alreadyProcessed: result.alreadyProcessed,
        };
      });
    }
  );

  // -----------------------------------------------------------------------
  // 5d. check_chain_balance
  // -----------------------------------------------------------------------
  server.tool(
    "check_chain_balance",
    "Check your onchain USDC balance on Base. Wallets are initialized automatically at registration, so this should always succeed for advertisers.",
    async () => {
      return handleToolCall(async () => {
        const wallet = await prisma.wallet.findUnique({
          where: { agentId },
        });
        if (!wallet?.chainAddress) {
          throw new AppError(
            "Wallet has no chain address. This should not happen for advertiser accounts — please contact support.",
            400,
            "WALLET_NOT_INITIALIZED"
          );
        }
        const balance = await chainService.getOnchainBalance(
          wallet.chainAddress
        );
        return {
          chainAddress: wallet.chainAddress,
          ...balance,
        };
      });
    }
  );

  // -----------------------------------------------------------------------
  // 6. get_reputation
  // -----------------------------------------------------------------------
  server.tool(
    "get_reputation",
    "Get the reputation profile for yourself or another agent. Returns trust tier, overall score, and dimension breakdowns.",
    {
      agent_id: z
        .string()
        .uuid()
        .optional()
        .describe("Agent ID to look up (omit for your own reputation)"),
    },
    async (params) => {
      return handleToolCall(async () => {
        const targetId = params.agent_id ?? agentId;
        const reputation = await reputationService.getReputation(targetId);
        return reputation;
      });
    }
  );

  // -----------------------------------------------------------------------
  // 7. get_analytics
  // -----------------------------------------------------------------------
  server.tool(
    "get_analytics",
    "Get performance analytics including lead counts, conversion rates, and earnings for your campaigns.",
    {
      campaign_id: z
        .string()
        .uuid()
        .optional()
        .describe("Filter analytics to a specific campaign"),
      period: z
        .enum(["24h", "7d", "30d", "90d", "all"])
        .optional()
        .describe("Time period for analytics (default 30d)"),
    },
    async (params) => {
      return handleToolCall(async () => {
        const period = params.period ?? "30d";
        const periodMs: Record<string, number> = {
          "24h": 24 * 60 * 60 * 1000,
          "7d": 7 * 24 * 60 * 60 * 1000,
          "30d": 30 * 24 * 60 * 60 * 1000,
          "90d": 90 * 24 * 60 * 60 * 1000,
          all: 0,
        };

        const dateFrom =
          period === "all"
            ? undefined
            : new Date(Date.now() - periodMs[period]);

        // Build where clause for leads
        const leadWhere: Record<string, unknown> = {
          affiliateId: agentId,
        };
        if (params.campaign_id) {
          leadWhere.campaignId = params.campaign_id;
        }
        if (dateFrom) {
          leadWhere.submittedAt = { gte: dateFrom };
        }

        // Build where clause for conversions
        const conversionWhere: Record<string, unknown> = {
          affiliateId: agentId,
        };
        if (params.campaign_id) {
          conversionWhere.campaignId = params.campaign_id;
        }
        if (dateFrom) {
          conversionWhere.occurredAt = { gte: dateFrom };
        }

        const [
          totalLeads,
          submittedLeads,
          verifiedLeads,
          rejectedLeads,
          totalConversions,
          earnings,
        ] = await Promise.all([
          prisma.lead.count({ where: leadWhere }),
          prisma.lead.count({
            where: { ...leadWhere, status: "SUBMITTED" },
          }),
          prisma.lead.count({
            where: { ...leadWhere, status: "VERIFIED" },
          }),
          prisma.lead.count({
            where: { ...leadWhere, status: "REJECTED" },
          }),
          prisma.conversionEvent.count({ where: conversionWhere }),
          prisma.lead.aggregate({
            where: { ...leadWhere, status: "VERIFIED" },
            _sum: { payoutCents: true },
          }),
        ]);

        const verificationRate =
          totalLeads > 0
            ? Math.round((verifiedLeads / totalLeads) * 10000) / 100
            : 0;

        return {
          period,
          campaignId: params.campaign_id ?? "all",
          leads: {
            total: totalLeads,
            submitted: submittedLeads,
            verified: verifiedLeads,
            rejected: rejectedLeads,
            verificationRate: `${verificationRate}%`,
          },
          conversions: {
            total: totalConversions,
          },
          earnings: {
            totalVerifiedCents: earnings._sum.payoutCents ?? 0,
          },
        };
      });
    }
  );

  return server;
}
