import { createHash } from "crypto";
import { CdpClient } from "@coinbase/cdp-sdk";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cdp: any = null;

/**
 * Singleton CDP client. Uses CDP_API_KEY_ID, CDP_API_KEY_PRIVATE_KEY
 * (mapped to apiKeySecret), and CDP_WALLET_SECRET from env.
 *
 * When creds are missing AND NODE_ENV !== "production" (i.e. CI/dev), or when
 * ALLOW_MOCK_CDP is explicitly enabled for local Docker smoke tests, falls back
 * to an in-process mock client so flows that only exercise address allocation
 * can run without CDP access. Any call that would require real chain writes
 * (sendUserOperation, requestFaucet) still throws loudly in mock mode.
 *
 * In production, missing creds remain fatal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCdp(): any {
  if (_cdp) return _cdp;

  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret =
    process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;
  const walletSecret = process.env.CDP_WALLET_SECRET;
  const allowMockCdp = ["1", "true", "yes"].includes(
    (process.env.ALLOW_MOCK_CDP ?? "").toLowerCase()
  );

  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    if (process.env.NODE_ENV === "production" && !allowMockCdp) {
      throw new Error(
        "CDP credentials missing — set CDP_API_KEY_ID, CDP_API_KEY_PRIVATE_KEY (or CDP_API_KEY_SECRET), and CDP_WALLET_SECRET"
      );
    }
    logger.warn(
      "CDP credentials missing; using in-process mock client. Advertiser deposit addresses will be fake; sendUserOperation/requestFaucet calls will throw. Set CDP_* env vars for real onchain operations."
    );
    _cdp = createMockCdp();
    return _cdp;
  }

  _cdp = new CdpClient({ apiKeyId, apiKeySecret, walletSecret });
  return _cdp;
}

/**
 * CDP account names must be alphanumeric + hyphens, 2-36 chars. Use a v2
 * hashed name for agent smart accounts so production does not try to reopen
 * older agent-id-named smart accounts that were created with the legacy owner.
 */
export function cdpSmartAccountNameForAgent(agentId: string): string {
  const hash = createHash("sha256").update(`agent:${agentId}`).digest("hex");
  return `agent-${hash.slice(0, 30)}`;
}

export const PLATFORM_HOT_ACCOUNT_NAME = "platform-hot";

/**
 * The platform hot smart account already exists in CDP under this legacy owner.
 * Keep that pairing so we do not strand any USDC already sent to platform-hot.
 */
export const PLATFORM_HOT_OWNER_ACCOUNT_NAME = "regatta-owner";

/**
 * CDP allows a given owner EOA to own only one smart account. Derive a stable,
 * CDP-valid owner EOA name for each smart account name so every agent deposit
 * account and the platform hot wallet get their own signer.
 */
export function cdpOwnerNameForSmartAccount(smartAccountName: string): string {
  const hash = createHash("sha256").update(smartAccountName).digest("hex");
  return `owner-${hash.slice(0, 30)}`;
}

// ---------------------------------------------------------------------------
// Mock CDP client (CI / local dev without creds)
// ---------------------------------------------------------------------------

function mockAddressForName(name: string): `0x${string}` {
  const hash = createHash("sha256").update(`cdp-mock:${name}`).digest("hex");
  return `0x${hash.slice(0, 40)}` as `0x${string}`;
}

interface MockAccount {
  address: `0x${string}`;
  name: string;
}

interface MockSmartAccount {
  address: `0x${string}`;
  name: string;
  owners: MockAccount[];
}

function createMockCdp() {
  const accountsByName = new Map<string, MockAccount>();
  const smartAccountsByName = new Map<string, MockSmartAccount>();
  const smartAccountNameByOwnerAddress = new Map<string, string>();

  return {
    evm: {
      async getOrCreateAccount({
        name,
      }: {
        name: string;
      }): Promise<MockAccount> {
        if (!accountsByName.has(name)) {
          accountsByName.set(name, {
            address: mockAddressForName(name),
            name,
          });
        }
        return accountsByName.get(name)!;
      },
      async getOrCreateSmartAccount({
        name,
        owner,
      }: {
        name: string;
        owner: MockAccount;
      }): Promise<MockSmartAccount> {
        const existingSmartAccount = smartAccountsByName.get(name);
        if (
          existingSmartAccount &&
          existingSmartAccount.owners[0].address !== owner.address
        ) {
          throw new Error(
            "Owner mismatch: The provided owner address is not an owner of the smart account. Please use a valid owner for this smart account."
          );
        }

        const existingName = smartAccountNameByOwnerAddress.get(owner.address);
        if (existingName && existingName !== name) {
          throw new Error(
            "Multiple smart wallets with the same owner is not supported."
          );
        }
        if (!smartAccountsByName.has(name)) {
          smartAccountsByName.set(name, {
            address: mockAddressForName(`smart:${name}`),
            name,
            owners: [owner],
          });
          smartAccountNameByOwnerAddress.set(owner.address, name);
        }
        return smartAccountsByName.get(name)!;
      },
      async getSmartAccount({
        address,
        name,
        owner,
      }: {
        address?: `0x${string}`;
        name?: string;
        owner: MockAccount;
      }): Promise<MockSmartAccount> {
        const smartAccount = address
          ? [...smartAccountsByName.values()].find(
              (account) =>
                account.address.toLowerCase() === address.toLowerCase()
            )
          : name
            ? smartAccountsByName.get(name)
            : null;

        if (!smartAccount) {
          throw new Error("Smart account not found");
        }
        if (smartAccount.owners[0].address !== owner.address) {
          throw new Error(
            "Owner mismatch: The provided owner address is not an owner of the smart account. Please use a valid owner for this smart account."
          );
        }
        return smartAccount;
      },
      async sendUserOperation(): Promise<never> {
        throw new Error(
          "MOCK CDP: sendUserOperation is not supported in mock mode. Set CDP_API_KEY_ID, CDP_API_KEY_PRIVATE_KEY, and CDP_WALLET_SECRET for real onchain transfers."
        );
      },
      async waitForUserOperation(): Promise<never> {
        throw new Error(
          "MOCK CDP: waitForUserOperation is not supported in mock mode."
        );
      },
      async requestFaucet(): Promise<never> {
        throw new Error(
          "MOCK CDP: requestFaucet is not supported in mock mode. Use the real CDP client for faucet drops."
        );
      },
    },
  };
}
