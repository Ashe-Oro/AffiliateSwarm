-- Add EXTERNAL to AccountType enum for onchain/offchain counterparties.
-- Used when USDC enters the platform (debit: EXTERNAL, credit: WALLET) or
-- exits via payout (debit: WALLET, credit: EXTERNAL).
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'EXTERNAL';
