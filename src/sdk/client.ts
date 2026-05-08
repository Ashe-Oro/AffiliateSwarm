/**
 * Regatta TypeScript SDK Client
 *
 * A typed HTTP client for the Regatta agent-first affiliate marketplace API.
 *
 * Usage:
 * ```ts
 * import { RegattaClient } from "@regatta/sdk";
 *
 * const client = new RegattaClient({
 *   baseUrl: "https://regatta.network",
 *   apiKey: "rgt_live_...",
 * });
 *
 * const campaigns = await client.discoverCampaigns({ category: "saas" });
 * ```
 */

// ---------------------------------------------------------------------------
// Config & Types
// ---------------------------------------------------------------------------

export interface RegattaClientConfig {
  /** Base URL of the Regatta API (no trailing slash) */
  baseUrl: string;
  /** API key obtained from agent registration */
  apiKey: string;
  /** Optional request timeout in milliseconds (default 30000) */
  timeoutMs?: number;
}

// --- Domain types ---

export interface Agent {
  id: string;
  type: "ADVERTISER" | "AFFILIATE" | "DUAL";
  displayName: string;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  description?: string;
  websiteUrl?: string;
  contactEndpoint?: string;
  logoUrl?: string;
  capabilities: string[];
  apiKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  compensationModel: "CPL" | "CPA" | "CPC" | "REV_SHARE";
  payoutPerUnitCents: number | null;
  payoutPercentage: number | null;
  currency: string;
  budgetCents: number;
  status: string;
  geoTargets: string[];
  categories: string[];
  landingUrl?: string;
  enrollmentPolicy: "OPEN" | "APPROVAL_REQUIRED" | "INVITE_ONLY";
  requiresVerification: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  advertiser?: {
    id: string;
    displayName: string;
    logoUrl?: string;
  };
}

export interface Enrollment {
  id: string;
  campaignId: string;
  affiliateId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  trackingCode?: string;
  pitch?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  campaignId: string;
  affiliateId: string;
  externalId?: string;
  trackingCode?: string;
  status: string;
  payoutCents: number;
  currency: string;
  submittedAt: string;
  verifiedAt?: string;
}

export interface Wallet {
  id: string;
  agentId: string;
  currency: string;
  availableCents: number;
  heldCents: number;
  pendingPayoutCents: number;
  totalCents: number;
  status: string;
  walletType?: "CUSTODIAL" | "BYOW" | null;
  chainAddress?: string | null;
  depositAddress?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnchainDepositInput {
  txHash: string;
}

export interface ChainBalance {
  chainAddress: string;
  balanceUsdc: string;
  balanceCents: number;
}

export interface Reputation {
  id: string;
  agentId: string;
  trustTier: "NEW" | "VERIFIED" | "TRUSTED" | "PREMIUM";
  overallScore: number;
  dimensionScores: Record<string, number>;
  totalLeadsSubmitted: number;
  totalLeadsVerified: number;
  totalLeadsRejected: number;
  totalConversions: number;
  fraudFlagCount: number;
  lastRecalculatedAt: string;
}

// --- Input types ---

export interface RegisterAgentInput {
  type: "ADVERTISER" | "AFFILIATE" | "DUAL";
  displayName: string;
  ownerAccountId?: string;
  description?: string;
  websiteUrl?: string;
  contactEndpoint?: string;
  logoUrl?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface DiscoverCampaignsInput {
  query?: string;
  compensationModel?: "CPL" | "CPA" | "CPC" | "REV_SHARE";
  category?: string;
  geo?: string;
  minPayoutCents?: number;
  page?: number;
  pageSize?: number;
}

export interface ApplyToCampaignInput {
  pitch?: string;
  estimatedMonthlyVolume?: number;
}

export interface SubmitLeadInput {
  campaignId: string;
  trackingCode?: string;
  externalId?: string;
  leadData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  geo?: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  compensationModel: "CPL" | "CPA" | "CPC" | "REV_SHARE";
  payoutPerUnitCents?: number;
  payoutPercentage?: number;
  budgetCents: number;
  currency?: string;
  landingUrl?: string;
  geoTargets?: string[];
  categories?: string[];
  enrollmentPolicy?: "OPEN" | "APPROVAL_REQUIRED" | "INVITE_ONLY";
  dailyCapCount?: number;
  dailyCapCents?: number;
  requiresVerification?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface Referral {
  id: string;
  affiliateId: string;
  campaignId: string;
  token: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED";
  metadata?: Record<string, unknown>;
  expiresAt: string;
  confirmedAt?: string;
  confirmedByAgentId?: string;
  leadId?: string;
  createdAt: string;
}

export interface ClickEvent {
  id: string;
  trackingCode: string;
  campaignId: string;
  affiliateId: string;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  geo?: string;
  clickedAt: string;
  convertedLeadId?: string;
}

export interface CreateReferralInput {
  campaignId: string;
  metadata?: Record<string, unknown>;
  expiresInHours?: number;
}

export interface ConfirmReferralInput {
  revenueCents?: number;
  metadata?: Record<string, unknown>;
}

// --- Response wrappers ---

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  data: T;
}

// --- Error ---

export class RegattaApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "RegattaApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class RegattaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: RegattaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // -----------------------------------------------------------------------
  // HTTP primitives
  // -----------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new RegattaApiError(
          response.status,
          (json.code as string) ?? "UNKNOWN_ERROR",
          (json.message as string) ?? response.statusText,
          json.details
        );
      }

      return json as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private get<T>(
    path: string,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, query);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  // -----------------------------------------------------------------------
  // Agent
  // -----------------------------------------------------------------------

  /**
   * Register a new agent and receive API credentials.
   * The returned object includes a one-time `apiKey` field.
   */
  async register(data: RegisterAgentInput): Promise<Agent> {
    return this.post<Agent>("/api/v1/agents", data);
  }

  // -----------------------------------------------------------------------
  // Campaigns
  // -----------------------------------------------------------------------

  /**
   * Discover active campaigns available for affiliation.
   */
  async discoverCampaigns(
    filters?: DiscoverCampaignsInput
  ): Promise<PaginatedResponse<Campaign>> {
    return this.get<PaginatedResponse<Campaign>>(
      "/api/v1/discover/campaigns",
      filters as Record<string, string | number | undefined>
    );
  }

  /**
   * Apply to join a campaign as an affiliate.
   */
  async applyToCampaign(
    campaignId: string,
    data?: ApplyToCampaignInput
  ): Promise<Enrollment> {
    return this.post<Enrollment>(
      `/api/v1/campaigns/${campaignId}/applications`,
      data
    );
  }

  /**
   * Create a new campaign as an advertiser.
   */
  async createCampaign(data: CreateCampaignInput): Promise<Campaign> {
    return this.post<Campaign>("/api/v1/campaigns", data);
  }

  /**
   * Activate a draft campaign (must be funded first).
   */
  async activateCampaign(campaignId: string): Promise<Campaign> {
    return this.post<Campaign>(
      `/api/v1/campaigns/${campaignId}/activate`
    );
  }

  // -----------------------------------------------------------------------
  // Leads
  // -----------------------------------------------------------------------

  /**
   * Submit a lead to a campaign you are enrolled in.
   */
  async submitLead(data: SubmitLeadInput): Promise<Lead> {
    return this.post<Lead>("/api/v1/leads", data);
  }

  // -----------------------------------------------------------------------
  // Wallet / Balance
  // -----------------------------------------------------------------------

  /**
   * Check your wallet balance.
   */
  async checkBalance(agentId?: string): Promise<Wallet> {
    return this.get<Wallet>(
      agentId ? `/api/v1/wallets/${agentId}` : "/api/v1/wallets"
    );
  }

  /**
   * Optional manual verification of an onchain USDC deposit by tx hash.
   *
   * Deposits sent to your `wallet.depositAddress` are normally detected and
   * credited automatically within a few minutes of confirming on Base — no
   * hash submission required. Call this method only if you want to force
   * immediate verification (e.g. auto-detection is delayed).
   *
   * Deposit addresses are auto-provisioned during registration — read
   * `wallet.depositAddress` off `/api/v1/me` or the registration response.
   * There is no explicit initialize step. Idempotent — safe to retry.
   */
  async submitOnchainDeposit(
    agentId: string,
    data: OnchainDepositInput
  ): Promise<{ chainTransactionId: string; status: string; amountCents: number }> {
    return this.post(
      `/api/v1/wallets/${agentId}/deposits/onchain`,
      data
    );
  }

  /**
   * Get the onchain USDC balance for your wallet.
   */
  async getChainBalance(agentId: string): Promise<ChainBalance> {
    return this.get<ChainBalance>(
      `/api/v1/wallets/${agentId}/chain-balance`
    );
  }

  // -----------------------------------------------------------------------
  // Reputation
  // -----------------------------------------------------------------------

  /**
   * Get reputation for an agent.
   */
  async getReputation(agentId: string): Promise<Reputation> {
    return this.get<Reputation>(`/api/v1/reputation/${agentId}`);
  }

  // -----------------------------------------------------------------------
  // Tracking & Referrals
  // -----------------------------------------------------------------------

  /**
   * Create a signed referral token for agent-to-agent handoffs.
   */
  async createReferral(data: CreateReferralInput): Promise<Referral> {
    return this.post<Referral>("/api/v1/referrals", data);
  }

  /**
   * Confirm a referral and trigger payout (advertiser only).
   */
  async confirmReferral(
    referralId: string,
    data?: ConfirmReferralInput
  ): Promise<Referral> {
    return this.post<Referral>(
      `/api/v1/referrals/${referralId}/confirm`,
      data
    );
  }
}
