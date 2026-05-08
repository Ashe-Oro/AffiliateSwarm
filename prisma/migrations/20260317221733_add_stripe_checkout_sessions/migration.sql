-- CreateEnum
CREATE TYPE "StripePaymentMethod" AS ENUM ('CARD', 'ACH');

-- CreateEnum
CREATE TYPE "StripeCheckoutStatus" AS ENUM ('PENDING', 'PENDING_PAYMENT', 'COMPLETED', 'EXPIRED', 'FAILED');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'STRIPE_DEPOSIT';

-- CreateTable
CREATE TABLE "stripe_checkout_sessions" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "paymentMethod" "StripePaymentMethod" NOT NULL,
    "requestedAmountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "netAmountCents" INTEGER NOT NULL,
    "status" "StripeCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripeStatus" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_checkout_sessions_stripeSessionId_key" ON "stripe_checkout_sessions"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_checkout_sessions_stripePaymentIntentId_key" ON "stripe_checkout_sessions"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "stripe_checkout_sessions_agentId_idx" ON "stripe_checkout_sessions"("agentId");

-- CreateIndex
CREATE INDEX "stripe_checkout_sessions_status_idx" ON "stripe_checkout_sessions"("status");

-- CreateIndex
CREATE INDEX "stripe_checkout_sessions_campaignId_idx" ON "stripe_checkout_sessions"("campaignId");

-- AddForeignKey
ALTER TABLE "stripe_checkout_sessions" ADD CONSTRAINT "stripe_checkout_sessions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_checkout_sessions" ADD CONSTRAINT "stripe_checkout_sessions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
