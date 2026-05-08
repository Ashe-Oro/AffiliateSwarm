-- Add refSeed to campaigns — a 32-byte hex seed used to derive per-affiliate
-- tracking codes via HMAC-SHA256(refSeed, affiliateId). Existing campaigns
-- get a backfilled seed so their existing enrollments still work (enrollments
-- keep their trackingCode column as the source of truth for lookups).
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "refSeed" VARCHAR(64);

UPDATE "campaigns"
SET "refSeed" = encode(decode(replace("id"::text, '-', ''), 'hex') || decode(replace("id"::text, '-', ''), 'hex'), 'hex')
WHERE "refSeed" IS NULL;
