-- Dedup guard for server-to-server postbacks (which carry a required externalId
-- and pay out immediately). Prevents concurrent duplicate postbacks from
-- creating two VERIFIED leads and double-releasing escrow.
--
-- Postgres treats NULLs as distinct, so leads without an externalId
-- (fingerprint-deduped submitLead leads) are unaffected.
--
-- NOTE: if pre-existing duplicate (campaignId, externalId) rows exist — i.e.
-- conversions that were already double-counted before this fix — this index
-- creation will fail. Those rows must be reconciled/de-duplicated first; they
-- represent the exact double-payout this migration closes.

-- CreateIndex
CREATE UNIQUE INDEX "leads_campaignId_externalId_key" ON "leads"("campaignId", "externalId");
