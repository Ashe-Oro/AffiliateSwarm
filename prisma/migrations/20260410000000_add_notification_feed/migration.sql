-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('CAMPAIGNS', 'APPLICATIONS', 'LEADS', 'TRACKING', 'EARNINGS', 'PAYOUTS');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agentId" UUID NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT NOT NULL,
    "resourceType" VARCHAR(50),
    "resourceId" UUID,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_agentId_createdAt_idx" ON "notifications"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_agentId_readAt_idx" ON "notifications"("agentId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_agentId_category_createdAt_idx" ON "notifications"("agentId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
