-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "referralCode" VARCHAR(32) NOT NULL,
    "revenueShareBps" INTEGER NOT NULL DEFAULT 1000,
    "totalEarnedCents" INTEGER NOT NULL DEFAULT 0,
    "pendingCents" INTEGER NOT NULL DEFAULT 0,
    "paidOutCents" INTEGER NOT NULL DEFAULT 0,
    "websiteUrl" VARCHAR(2048),
    "bio" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_referrals" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_email_key" ON "partners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "partners_referralCode_key" ON "partners"("referralCode");

-- CreateIndex
CREATE INDEX "partners_referralCode_idx" ON "partners"("referralCode");

-- CreateIndex
CREATE INDEX "partners_active_idx" ON "partners"("active");

-- CreateIndex
CREATE UNIQUE INDEX "partner_referrals_agentId_key" ON "partner_referrals"("agentId");

-- CreateIndex
CREATE INDEX "partner_referrals_partnerId_idx" ON "partner_referrals"("partnerId");

-- CreateIndex
CREATE INDEX "partner_referrals_agentId_idx" ON "partner_referrals"("agentId");

-- AddForeignKey
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
