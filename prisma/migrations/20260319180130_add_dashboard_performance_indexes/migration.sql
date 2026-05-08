-- CreateIndex
CREATE INDEX "click_events_campaignId_affiliateId_idx" ON "click_events"("campaignId", "affiliateId");

-- CreateIndex
CREATE INDEX "leads_affiliateId_submittedAt_idx" ON "leads"("affiliateId", "submittedAt");
