-- Add payoutPercentage column for REV_SHARE campaigns (integer 1-100).
-- Previously, payoutPerUnitCents was overloaded to store basis points for REV_SHARE;
-- this split makes the semantics explicit and prevents silent misuse.
ALTER TABLE "campaigns" ADD COLUMN "payoutPercentage" INTEGER;

-- Backfill existing REV_SHARE campaigns. The old payoutPerUnitCents held a basis-points
-- value (e.g. 1000 = 10%); convert to integer percentage by dividing by 100.
UPDATE "campaigns"
SET "payoutPercentage" = "payoutPerUnitCents" / 100
WHERE "compensationModel" = 'REV_SHARE';

-- payoutPerUnitCents no longer applies to REV_SHARE; make it nullable and clear it for REV_SHARE.
ALTER TABLE "campaigns" ALTER COLUMN "payoutPerUnitCents" DROP NOT NULL;

UPDATE "campaigns"
SET "payoutPerUnitCents" = NULL
WHERE "compensationModel" = 'REV_SHARE';
