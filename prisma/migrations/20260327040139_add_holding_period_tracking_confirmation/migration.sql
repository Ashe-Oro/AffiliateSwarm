-- AlterEnum
ALTER TYPE "HoldStatus" ADD VALUE 'PENDING_RELEASE';

-- DropForeignKey
ALTER TABLE "stripe_checkout_sessions" DROP CONSTRAINT "stripe_checkout_sessions_campaignId_fkey";

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "holdingPeriodDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "trackingConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "escrow_holds" ADD COLUMN     "releaseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stripe_checkout_sessions" ALTER COLUMN "campaignId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "escrow_holds_status_releaseAt_idx" ON "escrow_holds"("status", "releaseAt");

-- AddForeignKey
ALTER TABLE "stripe_checkout_sessions" ADD CONSTRAINT "stripe_checkout_sessions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
