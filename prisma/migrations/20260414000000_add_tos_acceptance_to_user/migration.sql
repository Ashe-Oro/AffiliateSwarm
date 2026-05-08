-- Add ToS acceptance tracking to user accounts
ALTER TABLE "user_accounts"
  ADD COLUMN "tosAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "tosVersion" VARCHAR(32);
