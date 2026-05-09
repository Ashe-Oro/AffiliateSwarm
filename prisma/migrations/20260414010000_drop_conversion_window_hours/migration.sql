-- Remove conversionWindowHours from Campaign.
-- Rationale: AffiliateSwarm no longer sits between the click and the advertiser's
-- landing page, and it does not set cookies. Attribution windows are entirely
-- the advertiser's responsibility. See issue #199.
ALTER TABLE "campaigns" DROP COLUMN "conversionWindowHours";
