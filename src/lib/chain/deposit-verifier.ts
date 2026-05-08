import { decodeEventLog } from "viem";
import { getPublicClient, USDC_ADDRESS, USDC_ABI } from "./config";
import { usdcToCents } from "./usdc";

export interface DepositVerification {
  verified: boolean;
  fromAddress?: string;
  toAddress?: string;
  amountUsdc?: bigint;
  amountCents?: number;
  blockNumber?: bigint;
}

/**
 * Verify an onchain USDC deposit by fetching the transaction receipt
 * and parsing Transfer logs.
 */
export async function verifyDeposit(
  txHash: `0x${string}`,
  expectedTo: string,
  minCents: number
): Promise<DepositVerification> {
  const client = getPublicClient();

  const receipt = await client.getTransactionReceipt({ hash: txHash });

  if (!receipt || receipt.status !== "success") {
    return { verified: false };
  }

  // Find USDC Transfer event in the logs
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: USDC_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "Transfer") continue;

      const { from, to, value } = decoded.args as {
        from: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
      };

      // Validate the recipient matches the expected deposit address
      if (to.toLowerCase() !== expectedTo.toLowerCase()) {
        continue;
      }

      const amountCents = usdcToCents(value);

      if (amountCents < minCents) {
        continue;
      }

      return {
        verified: true,
        fromAddress: from,
        toAddress: to,
        amountUsdc: value,
        amountCents,
        blockNumber: receipt.blockNumber,
      };
    } catch {
      // Not a Transfer event or wrong ABI, skip
      continue;
    }
  }

  return { verified: false };
}
