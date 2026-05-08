-- Track submitted ERC-4337 user operations so payout recovery can distinguish
-- "broadcast but not yet observed" from terminal transfer failure.
ALTER TABLE "chain_transactions"
ADD COLUMN "userOpHash" VARCHAR(66),
ADD COLUMN "idempotencyKey" VARCHAR(128);

CREATE UNIQUE INDEX "chain_transactions_userOpHash_key" ON "chain_transactions"("userOpHash");
CREATE UNIQUE INDEX "chain_transactions_idempotencyKey_key" ON "chain_transactions"("idempotencyKey");
CREATE INDEX "chain_transactions_userOpHash_idx" ON "chain_transactions"("userOpHash");
