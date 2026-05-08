-- Add CANCELLED as a terminal PayoutStatus for affiliates who want to
-- unwind a PENDING withdrawal before the processor runs.
ALTER TYPE "PayoutStatus" ADD VALUE 'CANCELLED';
