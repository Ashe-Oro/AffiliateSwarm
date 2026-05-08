-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('ADVERTISER', 'AFFILIATE', 'DUAL');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('UNVERIFIED', 'EMAIL_VERIFIED', 'IDENTITY_VERIFIED');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RateLimitTier" AS ENUM ('FREE', 'STANDARD', 'ELEVATED', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_ESCROW', 'ACTIVE', 'PAUSED', 'BUDGET_EXHAUSTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompensationModelType" AS ENUM ('CPL', 'CPA', 'CPC', 'REV_SHARE');

-- CreateEnum
CREATE TYPE "EnrollmentPolicy" AS ENUM ('OPEN', 'APPROVAL_REQUIRED', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'EXPIRED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('TRACKED', 'VERIFIED', 'REJECTED', 'ATTRIBUTED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('PURCHASE', 'SIGNUP', 'INSTALL', 'SUBSCRIPTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VerifierType" AS ENUM ('AUTOMATED', 'MANUAL', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "VerificationOutcome" AS ENUM ('PASSED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('FUNDED', 'PARTIALLY_RELEASED', 'FULLY_RELEASED', 'REFUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'PAYOUT', 'REFUND', 'FEE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('WALLET', 'ESCROW', 'PLATFORM_REVENUE', 'PLATFORM_RESERVE');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'CRYPTO', 'PLATFORM_CREDIT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('NEW', 'VERIFIED', 'TRUSTED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "FraudFlagType" AS ENUM ('VELOCITY_ANOMALY', 'DUPLICATE_PATTERN', 'GEO_MISMATCH', 'BOT_SIGNATURE', 'PAYMENT_FRAUD', 'DATA_INCONSISTENCY');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_CLEAN', 'RESOLVED_FRAUD');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "type" "AgentType" NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "ownerAccountId" UUID NOT NULL,
    "description" TEXT,
    "websiteUrl" VARCHAR(2048),
    "contactEndpoint" VARCHAR(2048),
    "logoUrl" VARCHAR(2048),
    "status" "AgentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'UNVERIFIED',
    "capabilities" TEXT[],
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "apiKeyHash" VARCHAR(255) NOT NULL,
    "apiKeyPrefix" VARCHAR(20) NOT NULL,
    "hmacSecret" VARCHAR(512) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "scopes" TEXT[],
    "rateLimitTier" "RateLimitTier" NOT NULL DEFAULT 'FREE',
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "compensationModel" "CompensationModelType" NOT NULL,
    "payoutPerUnitCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "budgetCents" INTEGER NOT NULL,
    "budgetSpentCents" INTEGER NOT NULL DEFAULT 0,
    "dailyCapCount" INTEGER,
    "dailyCapCents" INTEGER,
    "geoTargets" TEXT[],
    "categories" TEXT[],
    "landingUrl" VARCHAR(2048),
    "conversionWindowHours" INTEGER NOT NULL DEFAULT 720,
    "enrollmentPolicy" "EnrollmentPolicy" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
    "requiresVerification" BOOLEAN NOT NULL DEFAULT true,
    "leadRequirements" JSONB,
    "targetingCriteria" JSONB,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_enrollments" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "affiliateId" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingCode" VARCHAR(64),
    "customTerms" JSONB,
    "pitch" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "affiliateId" UUID NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'SUBMITTED',
    "externalId" VARCHAR(255),
    "trackingCode" VARCHAR(64),
    "leadData" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "geo" VARCHAR(2),
    "fingerprintHash" VARCHAR(64),
    "qualityScore" INTEGER,
    "qualitySignals" JSONB,
    "rejectionReason" TEXT,
    "payoutCents" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_events" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "affiliateId" UUID NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "conversionData" JSONB,
    "revenueCents" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payoutCents" INTEGER,
    "status" "ConversionStatus" NOT NULL DEFAULT 'TRACKED',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tasks" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "verifierType" "VerifierType" NOT NULL,
    "checks" JSONB,
    "outcome" "VerificationOutcome",
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "availableCents" INTEGER NOT NULL DEFAULT 0,
    "heldCents" INTEGER NOT NULL DEFAULT 0,
    "pendingPayoutCents" INTEGER NOT NULL DEFAULT 0,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_accounts" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "totalDepositedCents" INTEGER NOT NULL DEFAULT 0,
    "totalReleasedCents" INTEGER NOT NULL DEFAULT 0,
    "totalRefundedCents" INTEGER NOT NULL DEFAULT 0,
    "currentBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "EscrowStatus" NOT NULL DEFAULT 'FUNDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_holds" (
    "id" UUID NOT NULL,
    "escrowId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "affiliateId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "HoldStatus" NOT NULL DEFAULT 'HELD',
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "debitAccountType" "AccountType" NOT NULL,
    "debitAccountId" UUID NOT NULL,
    "creditAccountType" "AccountType" NOT NULL,
    "creditAccountId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "entryType" "LedgerEntryType" NOT NULL,
    "referenceType" VARCHAR(50),
    "referenceId" UUID,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" UUID NOT NULL,
    "affiliateId" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "method" "PayoutMethod" NOT NULL,
    "destination" JSONB NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_reputations" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "trustTier" "TrustTier" NOT NULL DEFAULT 'NEW',
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dimensionScores" JSONB,
    "totalLeadsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "totalLeadsVerified" INTEGER NOT NULL DEFAULT 0,
    "totalLeadsRejected" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "fraudFlagCount" INTEGER NOT NULL DEFAULT 0,
    "reputationHistory" JSONB,
    "lastRecalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_reputations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_investigations" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "triggerType" "FraudFlagType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "signals" JSONB,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peer_ratings" (
    "id" UUID NOT NULL,
    "fromAgentId" UUID NOT NULL,
    "toAgentId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "dimensions" JSONB,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "peer_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" UUID NOT NULL,
    "trackingCode" VARCHAR(64) NOT NULL,
    "campaignId" UUID NOT NULL,
    "affiliateId" UUID NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "referer" VARCHAR(2048),
    "geo" VARCHAR(2),
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedLeadId" UUID,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "affiliateId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByAgentId" UUID,
    "leadId" UUID,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_events" (
    "id" UUID NOT NULL,
    "aggregateType" VARCHAR(50) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_sessions" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "credentialId" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[],
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "authenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_logs" (
    "id" UUID NOT NULL,
    "sessionId" UUID,
    "agentId" UUID,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(2048) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "requestSize" INTEGER NOT NULL DEFAULT 0,
    "responseSize" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "traceId" VARCHAR(64),
    "errorCode" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowDurationMs" INTEGER NOT NULL,
    "maxRequests" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "events" TEXT[],
    "secret" VARCHAR(512) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_type_idx" ON "agents"("type");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agents_ownerAccountId_idx" ON "agents"("ownerAccountId");

-- CreateIndex
CREATE INDEX "agents_type_status_idx" ON "agents"("type", "status");

-- CreateIndex
CREATE INDEX "agents_deletedAt_idx" ON "agents"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_credentials_apiKeyHash_key" ON "api_credentials"("apiKeyHash");

-- CreateIndex
CREATE INDEX "api_credentials_agentId_idx" ON "api_credentials"("agentId");

-- CreateIndex
CREATE INDEX "api_credentials_status_idx" ON "api_credentials"("status");

-- CreateIndex
CREATE INDEX "api_credentials_apiKeyPrefix_idx" ON "api_credentials"("apiKeyPrefix");

-- CreateIndex
CREATE INDEX "campaigns_advertiserId_idx" ON "campaigns"("advertiserId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_compensationModel_idx" ON "campaigns"("compensationModel");

-- CreateIndex
CREATE INDEX "campaigns_status_compensationModel_idx" ON "campaigns"("status", "compensationModel");

-- CreateIndex
CREATE INDEX "campaigns_categories_idx" ON "campaigns" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "campaigns_geoTargets_idx" ON "campaigns" USING GIN ("geoTargets");

-- CreateIndex
CREATE INDEX "campaigns_startsAt_endsAt_idx" ON "campaigns"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "campaigns_deletedAt_idx" ON "campaigns"("deletedAt");

-- CreateIndex
CREATE INDEX "campaigns_createdAt_idx" ON "campaigns"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_enrollments_trackingCode_key" ON "affiliate_enrollments"("trackingCode");

-- CreateIndex
CREATE INDEX "affiliate_enrollments_affiliateId_idx" ON "affiliate_enrollments"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_enrollments_status_idx" ON "affiliate_enrollments"("status");

-- CreateIndex
CREATE INDEX "affiliate_enrollments_campaignId_status_idx" ON "affiliate_enrollments"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_enrollments_campaignId_affiliateId_key" ON "affiliate_enrollments"("campaignId", "affiliateId");

-- CreateIndex
CREATE INDEX "leads_campaignId_status_idx" ON "leads"("campaignId", "status");

-- CreateIndex
CREATE INDEX "leads_affiliateId_status_idx" ON "leads"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "leads_campaignId_affiliateId_idx" ON "leads"("campaignId", "affiliateId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_fingerprintHash_idx" ON "leads"("fingerprintHash");

-- CreateIndex
CREATE INDEX "leads_externalId_idx" ON "leads"("externalId");

-- CreateIndex
CREATE INDEX "leads_campaignId_fingerprintHash_idx" ON "leads"("campaignId", "fingerprintHash");

-- CreateIndex
CREATE INDEX "leads_submittedAt_idx" ON "leads"("submittedAt");

-- CreateIndex
CREATE INDEX "leads_campaignId_submittedAt_idx" ON "leads"("campaignId", "submittedAt");

-- CreateIndex
CREATE INDEX "leads_status_submittedAt_idx" ON "leads"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "conversion_events_leadId_idx" ON "conversion_events"("leadId");

-- CreateIndex
CREATE INDEX "conversion_events_campaignId_status_idx" ON "conversion_events"("campaignId", "status");

-- CreateIndex
CREATE INDEX "conversion_events_affiliateId_status_idx" ON "conversion_events"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "conversion_events_campaignId_occurredAt_idx" ON "conversion_events"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "conversion_events_status_idx" ON "conversion_events"("status");

-- CreateIndex
CREATE INDEX "conversion_events_occurredAt_idx" ON "conversion_events"("occurredAt");

-- CreateIndex
CREATE INDEX "verification_tasks_leadId_idx" ON "verification_tasks"("leadId");

-- CreateIndex
CREATE INDEX "verification_tasks_outcome_idx" ON "verification_tasks"("outcome");

-- CreateIndex
CREATE INDEX "verification_tasks_leadId_outcome_idx" ON "verification_tasks"("leadId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_agentId_key" ON "wallets"("agentId");

-- CreateIndex
CREATE INDEX "wallets_status_idx" ON "wallets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_accounts_campaignId_key" ON "escrow_accounts"("campaignId");

-- CreateIndex
CREATE INDEX "escrow_accounts_advertiserId_idx" ON "escrow_accounts"("advertiserId");

-- CreateIndex
CREATE INDEX "escrow_accounts_status_idx" ON "escrow_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_holds_leadId_key" ON "escrow_holds"("leadId");

-- CreateIndex
CREATE INDEX "escrow_holds_escrowId_status_idx" ON "escrow_holds"("escrowId", "status");

-- CreateIndex
CREATE INDEX "escrow_holds_affiliateId_idx" ON "escrow_holds"("affiliateId");

-- CreateIndex
CREATE INDEX "escrow_holds_status_idx" ON "escrow_holds"("status");

-- CreateIndex
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");

-- CreateIndex
CREATE INDEX "ledger_entries_debitAccountId_idx" ON "ledger_entries"("debitAccountId");

-- CreateIndex
CREATE INDEX "ledger_entries_creditAccountId_idx" ON "ledger_entries"("creditAccountId");

-- CreateIndex
CREATE INDEX "ledger_entries_entryType_idx" ON "ledger_entries"("entryType");

-- CreateIndex
CREATE INDEX "ledger_entries_referenceType_referenceId_idx" ON "ledger_entries"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ledger_entries_createdAt_idx" ON "ledger_entries"("createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_debitAccountId_createdAt_idx" ON "ledger_entries"("debitAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_creditAccountId_createdAt_idx" ON "ledger_entries"("creditAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "payout_requests_affiliateId_status_idx" ON "payout_requests"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "payout_requests_status_idx" ON "payout_requests"("status");

-- CreateIndex
CREATE INDEX "payout_requests_requestedAt_idx" ON "payout_requests"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_reputations_agentId_key" ON "agent_reputations"("agentId");

-- CreateIndex
CREATE INDEX "agent_reputations_trustTier_idx" ON "agent_reputations"("trustTier");

-- CreateIndex
CREATE INDEX "agent_reputations_overallScore_idx" ON "agent_reputations"("overallScore");

-- CreateIndex
CREATE INDEX "agent_reputations_trustTier_overallScore_idx" ON "agent_reputations"("trustTier", "overallScore");

-- CreateIndex
CREATE INDEX "fraud_investigations_agentId_idx" ON "fraud_investigations"("agentId");

-- CreateIndex
CREATE INDEX "fraud_investigations_status_idx" ON "fraud_investigations"("status");

-- CreateIndex
CREATE INDEX "fraud_investigations_agentId_status_idx" ON "fraud_investigations"("agentId", "status");

-- CreateIndex
CREATE INDEX "fraud_investigations_severity_idx" ON "fraud_investigations"("severity");

-- CreateIndex
CREATE INDEX "fraud_investigations_openedAt_idx" ON "fraud_investigations"("openedAt");

-- CreateIndex
CREATE INDEX "peer_ratings_toAgentId_idx" ON "peer_ratings"("toAgentId");

-- CreateIndex
CREATE INDEX "peer_ratings_campaignId_idx" ON "peer_ratings"("campaignId");

-- CreateIndex
CREATE INDEX "peer_ratings_toAgentId_createdAt_idx" ON "peer_ratings"("toAgentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "peer_ratings_fromAgentId_toAgentId_campaignId_key" ON "peer_ratings"("fromAgentId", "toAgentId", "campaignId");

-- CreateIndex
CREATE INDEX "click_events_trackingCode_idx" ON "click_events"("trackingCode");

-- CreateIndex
CREATE INDEX "click_events_campaignId_clickedAt_idx" ON "click_events"("campaignId", "clickedAt");

-- CreateIndex
CREATE INDEX "click_events_affiliateId_clickedAt_idx" ON "click_events"("affiliateId", "clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_token_key" ON "referrals"("token");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_leadId_key" ON "referrals"("leadId");

-- CreateIndex
CREATE INDEX "referrals_affiliateId_idx" ON "referrals"("affiliateId");

-- CreateIndex
CREATE INDEX "referrals_campaignId_idx" ON "referrals"("campaignId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "domain_events_aggregateType_aggregateId_idx" ON "domain_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "domain_events_eventType_idx" ON "domain_events"("eventType");

-- CreateIndex
CREATE INDEX "domain_events_aggregateType_aggregateId_version_idx" ON "domain_events"("aggregateType", "aggregateId", "version");

-- CreateIndex
CREATE INDEX "domain_events_createdAt_idx" ON "domain_events"("createdAt");

-- CreateIndex
CREATE INDEX "domain_events_publishedAt_idx" ON "domain_events"("publishedAt");

-- CreateIndex
CREATE INDEX "api_sessions_agentId_idx" ON "api_sessions"("agentId");

-- CreateIndex
CREATE INDEX "api_sessions_status_idx" ON "api_sessions"("status");

-- CreateIndex
CREATE INDEX "api_sessions_expiresAt_idx" ON "api_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "api_sessions_agentId_status_idx" ON "api_sessions"("agentId", "status");

-- CreateIndex
CREATE INDEX "request_logs_agentId_createdAt_idx" ON "request_logs"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "request_logs_sessionId_idx" ON "request_logs"("sessionId");

-- CreateIndex
CREATE INDEX "request_logs_path_createdAt_idx" ON "request_logs"("path", "createdAt");

-- CreateIndex
CREATE INDEX "request_logs_statusCode_createdAt_idx" ON "request_logs"("statusCode", "createdAt");

-- CreateIndex
CREATE INDEX "request_logs_createdAt_idx" ON "request_logs"("createdAt");

-- CreateIndex
CREATE INDEX "request_logs_traceId_idx" ON "request_logs"("traceId");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_agentId_idx" ON "rate_limit_buckets"("agentId");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_windowStart_idx" ON "rate_limit_buckets"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_buckets_agentId_endpoint_windowStart_key" ON "rate_limit_buckets"("agentId", "endpoint", "windowStart");

-- CreateIndex
CREATE INDEX "webhook_endpoints_agentId_idx" ON "webhook_endpoints"("agentId");

-- CreateIndex
CREATE INDEX "webhook_endpoints_active_idx" ON "webhook_endpoints"("active");

-- CreateIndex
CREATE INDEX "webhook_endpoints_agentId_active_idx" ON "webhook_endpoints"("agentId", "active");

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_enrollments" ADD CONSTRAINT "affiliate_enrollments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_enrollments" ADD CONSTRAINT "affiliate_enrollments_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "escrow_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_reputations" ADD CONSTRAINT "agent_reputations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_investigations" ADD CONSTRAINT "fraud_investigations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_ratings" ADD CONSTRAINT "peer_ratings_fromAgentId_fkey" FOREIGN KEY ("fromAgentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_ratings" ADD CONSTRAINT "peer_ratings_toAgentId_fkey" FOREIGN KEY ("toAgentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_ratings" ADD CONSTRAINT "peer_ratings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_convertedLeadId_fkey" FOREIGN KEY ("convertedLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_confirmedByAgentId_fkey" FOREIGN KEY ("confirmedByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_sessions" ADD CONSTRAINT "api_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_sessions" ADD CONSTRAINT "api_sessions_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "api_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
