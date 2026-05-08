import { z } from "zod";

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

export const SubmitOnchainDepositSchema = z.object({
  txHash: z.string().regex(TX_HASH_REGEX, "Invalid transaction hash (must be 66-char hex)"),
});

export type SubmitOnchainDepositInput = z.infer<typeof SubmitOnchainDepositSchema>;
