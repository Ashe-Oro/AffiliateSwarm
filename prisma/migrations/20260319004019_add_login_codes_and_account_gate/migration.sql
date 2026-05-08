-- CreateEnum
CREATE TYPE "AccountGate" AS ENUM ('PENDING', 'FUNDED', 'LIVE');

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "accountGate" "AccountGate" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "login_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "userId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_codes_code_key" ON "login_codes"("code");

-- CreateIndex
CREATE INDEX "login_codes_code_idx" ON "login_codes"("code");

-- CreateIndex
CREATE INDEX "login_codes_expiresAt_idx" ON "login_codes"("expiresAt");

-- AddForeignKey
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
