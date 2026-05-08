-- Per-agent email outcome tracking. PR #2 of the email reliability series.
-- Populated by agent.service.ts on every send attempt; read by the admin
-- agent detail page, the agent self-serve dashboard, and the Phase 3 sweep
-- job that retries any agent left with `*SentAt IS NULL` after an hour.
--
-- All columns are nullable and additive: backfilling old rows isn't required
-- (NULL = "no send recorded yet"). Rollback is `DROP COLUMN` for each.

-- AlterTable
ALTER TABLE "agents"
ADD COLUMN "verificationEmailSentAt" TIMESTAMP(3),
ADD COLUMN "verificationEmailLastError" TEXT,
ADD COLUMN "verificationEmailLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "onboardingEmailSentAt" TIMESTAMP(3),
ADD COLUMN "onboardingEmailLastError" TEXT,
ADD COLUMN "onboardingEmailLastAttemptAt" TIMESTAMP(3);
