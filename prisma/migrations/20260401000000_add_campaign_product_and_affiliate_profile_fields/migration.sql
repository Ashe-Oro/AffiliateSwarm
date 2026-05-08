-- Add affiliate profile fields to Agent model
ALTER TABLE "agents" ADD COLUMN "audienceSize" INTEGER;
ALTER TABLE "agents" ADD COLUMN "channels" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "agents" ADD COLUMN "contentType" VARCHAR(100);
ALTER TABLE "agents" ADD COLUMN "relevantUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "agents" ADD COLUMN "audienceGeo" VARCHAR(2);

-- Add campaign product fields to Campaign model
ALTER TABLE "campaigns" ADD COLUMN "productUrl" VARCHAR(2048);
ALTER TABLE "campaigns" ADD COLUMN "conversionAction" VARCHAR(100);
ALTER TABLE "campaigns" ADD COLUMN "productDescription" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "brandAssets" JSONB;
