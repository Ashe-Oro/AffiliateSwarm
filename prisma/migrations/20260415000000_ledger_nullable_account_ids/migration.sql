-- Allow null account ids for EXTERNAL counterparties (e.g. an onchain USDC
-- deposit source, a crypto payout destination). There's no internal account
-- row on the outside of the boundary, so forcing a UUID was wrong.
ALTER TABLE "ledger_entries" ALTER COLUMN "debitAccountId" DROP NOT NULL;
ALTER TABLE "ledger_entries" ALTER COLUMN "creditAccountId" DROP NOT NULL;
