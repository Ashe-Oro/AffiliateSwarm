-- AlterTable: add buyer incentive fields to campaigns
ALTER TABLE "campaigns" ADD COLUMN "buyerIncentiveType" VARCHAR(20);
ALTER TABLE "campaigns" ADD COLUMN "buyerIncentiveValue" VARCHAR(255);
ALTER TABLE "campaigns" ADD COLUMN "buyerIncentiveLabel" VARCHAR(255);
ALTER TABLE "campaigns" ADD COLUMN "buyerCouponCode" VARCHAR(100);
