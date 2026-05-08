-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('CUSTODIAL', 'BYOW');

-- CreateEnum
CREATE TYPE "ChainTransactionStatus" AS ENUM ('PENDING_SUBMISSION', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'CHAIN_DEPOSIT';
ALTER TYPE "LedgerEntryType" ADD VALUE 'CHAIN_PAYOUT';

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "chainAddress" VARCHAR(42),
ADD COLUMN     "depositAddress" VARCHAR(42),
ADD COLUMN     "hdDerivationIndex" INTEGER,
ADD COLUMN     "walletType" "WalletType";

-- CreateTable
CREATE TABLE "chain_transactions" (
    "id" UUID NOT NULL,
    "walletId" UUID,
    "payoutRequestId" UUID,
    "direction" VARCHAR(10) NOT NULL,
    "txHash" VARCHAR(66),
    "fromAddress" VARCHAR(42),
    "toAddress" VARCHAR(42),
    "amountUsdc" BIGINT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 8453,
    "status" "ChainTransactionStatus" NOT NULL,
    "blockNumber" BIGINT,
    "gasUsedWei" BIGINT,
    "errorMessage" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chain_transactions_payoutRequestId_key" ON "chain_transactions"("payoutRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "chain_transactions_txHash_key" ON "chain_transactions"("txHash");

-- CreateIndex
CREATE INDEX "chain_transactions_txHash_idx" ON "chain_transactions"("txHash");

-- CreateIndex
CREATE INDEX "chain_transactions_walletId_direction_idx" ON "chain_transactions"("walletId", "direction");

-- CreateIndex
CREATE INDEX "chain_transactions_status_idx" ON "chain_transactions"("status");

-- CreateIndex
CREATE INDEX "chain_transactions_payoutRequestId_idx" ON "chain_transactions"("payoutRequestId");

-- CreateIndex
CREATE INDEX "wallets_chainAddress_idx" ON "wallets"("chainAddress");

-- CreateIndex
CREATE INDEX "wallets_depositAddress_idx" ON "wallets"("depositAddress");

-- AddForeignKey
ALTER TABLE "chain_transactions" ADD CONSTRAINT "chain_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chain_transactions" ADD CONSTRAINT "chain_transactions_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "payout_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
