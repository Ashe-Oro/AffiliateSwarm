import { prisma } from "@/lib/prisma";
import {
  getCdp,
  cdpSmartAccountNameForAgent,
  cdpOwnerNameForSmartAccount,
  PLATFORM_HOT_ACCOUNT_NAME,
  PLATFORM_HOT_OWNER_ACCOUNT_NAME,
} from "./cdp";

// ---------------------------------------------------------------------------
// CDP-backed wallet management (smart accounts)
// ---------------------------------------------------------------------------
//
// All private keys live in CDP. Platform never handles seed phrases or signers.
//
// Architecture (post gas-sponsorship):
//   - Each smart account gets a dedicated owner EOA because CDP supports only
//     one smart account per owner.
//   - Each agent gets a v2 hashed smart account name, plus a deterministic
//     owner EOA name derived from that smart account name.
//   - Platform hot wallet keeps the existing smart account name "platform-hot"
//     and its legacy owner "regatta-owner" so existing funds remain reachable.
//   - All sends go through sendUserOperation with a paymaster URL on mainnet
//     (Coinbase auto-sponsors on Sepolia), so no smart account ever needs ETH.
// ---------------------------------------------------------------------------

export interface ChainAccount {
  /** Smart account address (the deposit address users send USDC to). */
  address: `0x${string}`;
  /** CDP account name — stable per agent / per role. */
  name: string;
  /** The smart account object from the CDP SDK (owns sendUserOperation). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  smartAccount: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _ownerPromises = new Map<string, Promise<any>>();

/**
 * Get-or-create the owner EOA for one smart account. Memoized by owner name
 * for the process lifetime, but rejected promises are cleared so transient CDP
 * failures don't poison every later wallet/payout/sweep call until restart.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOwner(ownerName: string): Promise<any> {
  if (!_ownerPromises.has(ownerName)) {
    const cdp = getCdp();
    const ownerPromise = cdp.evm
      .getOrCreateAccount({ name: ownerName })
      .catch((err: unknown) => {
        _ownerPromises.delete(ownerName);
        throw err;
      });
    _ownerPromises.set(ownerName, ownerPromise);
  }
  return _ownerPromises.get(ownerName)!;
}

async function getOrCreateSmartAccount(
  name: string,
  ownerName = cdpOwnerNameForSmartAccount(name)
): Promise<ChainAccount> {
  const cdp = getCdp();
  const owner = await getOwner(ownerName);
  const smartAccount = await cdp.evm.getOrCreateSmartAccount({ name, owner });
  return {
    address: smartAccount.address as `0x${string}`,
    name,
    smartAccount,
  };
}

/**
 * Get or create a CDP smart account for an agent. Idempotent.
 * The address is what we store as the agent's deposit address.
 */
export async function getOrCreateAgentAccount(
  agentId: string
): Promise<ChainAccount> {
  return getOrCreateSmartAccount(cdpSmartAccountNameForAgent(agentId));
}

/**
 * Get or create the platform hot-wallet smart account.
 */
export async function getPlatformAccount(): Promise<ChainAccount> {
  return getOrCreateSmartAccount(
    PLATFORM_HOT_ACCOUNT_NAME,
    PLATFORM_HOT_OWNER_ACCOUNT_NAME
  );
}

/**
 * Get next derivation sequence number. Still stored for audit/ordering;
 * no longer derives keys (those live in CDP).
 */
export async function nextDerivationIndex(): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(42)");
    const agg = await tx.wallet.aggregate({
      _max: { hdDerivationIndex: true },
    });
    return (agg._max.hdDerivationIndex ?? 0) + 1;
  });
  return result;
}
