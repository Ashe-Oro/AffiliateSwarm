import {
  getPublicClient,
  USDC_ADDRESS,
  USDC_ABI,
  CDP_NETWORK_ID,
  IS_TESTNET,
} from "./config";
import { getCdp } from "./cdp";
import type { ChainAccount } from "./wallet";

export const USDC_DECIMALS = 6;

export class UserOperationFailedError extends Error {
  constructor(
    message: string,
    public readonly userOpHash: `0x${string}`
  ) {
    super(message);
    this.name = "UserOperationFailedError";
  }
}

export function isUserOperationFailedError(
  err: unknown
): err is UserOperationFailedError {
  return err instanceof UserOperationFailedError;
}

/**
 * Convert cents to USDC base units (6 decimals).
 * 1 cent = 10,000 USDC base units (0.01 USDC = 10000 units).
 */
export function centsToUsdc(cents: number): bigint {
  return BigInt(cents) * 10_000n;
}

/**
 * Convert USDC base units to cents. Truncates (floors).
 */
export function usdcToCents(usdc: bigint): number {
  return Number(usdc / 10_000n);
}

/**
 * Get the USDC balance of an address.
 */
export async function getUsdcBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return balance;
}

/**
 * Resolve the paymaster URL for the active network. Coinbase sponsors
 * user operations on Base Sepolia automatically (no URL required), but
 * mainnet requires us to provide an ERC-7677 paymaster endpoint.
 */
function getPaymasterUrl(): string | undefined {
  if (IS_TESTNET) return undefined; // sponsored automatically on base-sepolia
  const url = process.env.CDP_PAYMASTER_URL;
  if (!url) {
    throw new Error(
      "CDP_PAYMASTER_URL is required on Base mainnet — provision a paymaster URL in the CDP dashboard and set it on the deployment."
    );
  }
  return url;
}

export interface SubmittedUsdcTransfer {
  userOpHash: `0x${string}`;
  smartAccountAddress: `0x${string}`;
}

export interface CompletedUsdcTransfer {
  txHash: `0x${string}`;
}

/**
 * Submit a USDC transfer user operation. The returned userOpHash must be
 * persisted before waiting so recovery can reconcile in-flight operations.
 */
export async function submitUsdcTransfer(
  fromAccount: ChainAccount,
  toAddress: `0x${string}`,
  amountUsdc: bigint,
  options: { idempotencyKey?: string } = {}
): Promise<SubmittedUsdcTransfer> {
  const cdp = getCdp();

  const { userOpHash } = await cdp.evm.sendUserOperation({
    smartAccount: fromAccount.smartAccount,
    network: CDP_NETWORK_ID,
    paymasterUrl: getPaymasterUrl(),
    idempotencyKey: options.idempotencyKey,
    calls: [
      {
        to: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [toAddress, amountUsdc],
      },
    ],
  });

  return {
    userOpHash: userOpHash as `0x${string}`,
    smartAccountAddress: fromAccount.address,
  };
}

/**
 * Wait for a previously submitted transfer user operation to complete.
 * Throws UserOperationFailedError only when CDP reports terminal failure;
 * transport/timeouts remain ordinary errors so callers can leave the op
 * in-flight for recovery instead of refunding prematurely.
 */
export async function waitForUsdcTransfer(
  smartAccountAddress: `0x${string}`,
  userOpHash: `0x${string}`
): Promise<CompletedUsdcTransfer> {
  const cdp = getCdp();

  const result = await cdp.evm.waitForUserOperation({
    smartAccountAddress,
    userOpHash,
  });

  if (result.status !== "complete") {
    throw new UserOperationFailedError(
      `User operation ${userOpHash} failed for smart account ${smartAccountAddress}`,
      userOpHash
    );
  }

  return { txHash: result.transactionHash as `0x${string}` };
}

/**
 * Transfer USDC from a CDP-managed smart account to a destination address.
 * The platform's owner EOA signs the user op; gas is sponsored via the
 * paymaster. Returns the transaction hash once the user op completes.
 */
export async function transferUsdc(
  fromAccount: ChainAccount,
  toAddress: `0x${string}`,
  amountUsdc: bigint
): Promise<`0x${string}`> {
  const { userOpHash } = await submitUsdcTransfer(
    fromAccount,
    toAddress,
    amountUsdc
  );
  const { txHash } = await waitForUsdcTransfer(fromAccount.address, userOpHash);
  return txHash;
}
