-- AlterTable
ALTER TABLE "agents" ADD COLUMN "email" VARCHAR(255),
ADD COLUMN "emailVerifyToken" VARCHAR(255),
ADD COLUMN "emailVerifyTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");
