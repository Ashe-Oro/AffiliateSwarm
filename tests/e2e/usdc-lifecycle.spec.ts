/**
 * USDC on-chain e2e — full lifecycle on Base Sepolia via CDP Server Wallets.
 *
 *   1. Advertiser inits CUSTODIAL wallet → CDP creates a deposit address
 *   2. CDP faucet sends USDC to that address
 *   3. Advertiser submits the deposit txHash → escrow credited onchain
 *   4. Affiliate converts → wallet credited $9.50 net of 5% platform fee
 *   5. Affiliate requests CRYPTO payout → admin processes → real USDC tx
 *   6. Verify receiver balance increased on Base Sepolia
 *
 * Requires: CHAIN_NETWORK=base-sepolia, BASE_RPC_URL, CDP_API_KEY_ID,
 * CDP_API_KEY_PRIVATE_KEY, CDP_WALLET_SECRET in env. Skipped otherwise.
 */

import { test, expect } from "@playwright/test";
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";
import {
  api,
  registerAgent,
  verifyAgentEmail,
  createCampaign,
  confirmTracking,
  activateCampaign,
  applyToCampaign,
  followTrackingLink,
  firePostback,
  getWalletBalance,
  requestPayout,
  listPayouts,
} from "./helpers";
import {
  PLATFORM_HOT_ACCOUNT_NAME,
  PLATFORM_HOT_OWNER_ACCOUNT_NAME,
} from "../../src/lib/chain/cdp";

const IS_SEPOLIA = (process.env.CHAIN_NETWORK || "").toLowerCase() === "base-sepolia";
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const RUN_ID = Date.now();

test.describe.configure({ mode: "serial" });
test.skip(!IS_SEPOLIA, "USDC e2e requires CHAIN_NETWORK=base-sepolia");

const cdp = IS_SEPOLIA
  ? new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret:
        process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY!,
      walletSecret: process.env.CDP_WALLET_SECRET!,
    })
  : (null as unknown as CdpClient);

const viemClient = IS_SEPOLIA
  ? createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_RPC_URL!),
    })
  : (null as ReturnType<typeof createPublicClient> | null);

async function usdcBalance(address: `0x${string}`): Promise<bigint> {
  return (await viemClient!.readContract({
    address: USDC_SEPOLIA,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
}

async function waitForUsdcCredit(
  address: `0x${string}`,
  startingBalance: bigint,
  timeoutMs = 90_000
): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const bal = await usdcBalance(address);
    if (bal > startingBalance) return bal;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`USDC balance for ${address} did not increase within ${timeoutMs}ms`);
}

// Shared state across tests
const state: {
  advertiser?: { agentId: string; apiKey: string; depositAddress: string | null };
  affiliate?: { agentId: string; apiKey: string; depositAddress: string | null };
  affiliateReceivingAddress?: `0x${string}`;
  depositAddress?: `0x${string}`;
  depositTxHashes?: `0x${string}`[];
  walletCreditedCents?: number;
  campaignId?: string;
  testTrackingCode?: string;
  trackingCode?: string;
  payoutId?: string;
  payoutTxHash?: string;
} = {};

// ═══════════════════════════════════════════════════════════════════════
// 1. ADVERTISER SETUP
// ═══════════════════════════════════════════════════════════════════════

test("1.1 advertiser registers and verifies email", async () => {
  state.advertiser = await registerAgent(
    `USDC Advertiser ${RUN_ID}`,
    "ADVERTISER",
    `e2e-usdc-adv-${RUN_ID}@test.regatta.dev`
  );
  await verifyAgentEmail(state.advertiser.agentId);
});

// CDP Sepolia USDC faucet sends 1 USDC = 100 cents per drop. Platform minimum
// payout is 100 cents, so we drive 2 conversions to clear the threshold:
// 2 × $1 CPA − 5% platform fee = 190 cents net to affiliate.
const CPA_CENTS = 100;
const NUM_CONVERSIONS = 2;
const FEE_PER_CONVERSION = Math.ceil(CPA_CENTS * 0.05);
const EXPECTED_AFFILIATE_CENTS = (CPA_CENTS - FEE_PER_CONVERSION) * NUM_CONVERSIONS; // 190

test("1.2 advertiser creates a CPA campaign ($1 flat payout — fits faucet drop)", async () => {
  const { campaignId, testTrackingCode } = await createCampaign(state.advertiser!.apiKey, {
    name: `USDC E2E ${RUN_ID}`,
    description: "USDC onchain e2e",
    compensationModel: "CPA",
    payoutPerUnitCents: CPA_CENTS,
    budgetCents: CPA_CENTS * NUM_CONVERSIONS,
    landingUrl: `${process.env.BASE_URL || "http://localhost:3099"}/api/test/mock-landing`,
    holdingPeriodDays: 0,
    enrollmentPolicy: "OPEN",
  });
  state.campaignId = campaignId;
  state.testTrackingCode = testTrackingCode;
});

// ═══════════════════════════════════════════════════════════════════════
// 2. CDP WALLET INITIALIZATION + FAUCET FUND + ONCHAIN DEPOSIT
// ═══════════════════════════════════════════════════════════════════════

test("2.1 advertiser gets a CDP deposit address from registration (auto-initialized)", async () => {
  // No explicit initialize call — advertisers exit registration with a
  // usable deposit address. Verify both the registration response and the
  // /me endpoint surface it.
  expect(state.advertiser!.depositAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  state.depositAddress = state.advertiser!.depositAddress as `0x${string}`;

  const { status, json } = await api(
    "GET",
    "/api/v1/me",
    undefined,
    state.advertiser!.apiKey
  );
  expect(status).toBe(200);
  expect(json.data.wallet.depositAddress).toBe(state.depositAddress);
});

test("2.2 CDP faucet funds the deposit address (one drop per conversion)", async () => {
  test.setTimeout(180_000);
  const hashes: `0x${string}`[] = [];
  for (let i = 0; i < NUM_CONVERSIONS; i++) {
    const before = await usdcBalance(state.depositAddress!);
    const { transactionHash } = await cdp.evm.requestFaucet({
      address: state.depositAddress!,
      network: "base-sepolia",
      token: "usdc",
    });
    expect(transactionHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    hashes.push(transactionHash as `0x${string}`);
    await waitForUsdcCredit(state.depositAddress!, before);
  }
  state.depositTxHashes = hashes;
});

test("2.3 advertiser submits each onchain deposit → wallet credited", async () => {
  test.setTimeout(60_000);
  let totalCents = 0;
  for (const txHash of state.depositTxHashes!) {
    const { status, json } = await api(
      "POST",
      `/api/v1/wallets/${state.advertiser!.agentId}/deposits/onchain`,
      { txHash },
      state.advertiser!.apiKey
    );
    expect(status).toBe(201);
    expect(json.data.status).toBe("CONFIRMED");
    totalCents += json.data.amountCents;
  }
  expect(totalCents).toBeGreaterThanOrEqual(CPA_CENTS * NUM_CONVERSIONS);
  state.walletCreditedCents = totalCents;
});

test("2.4 wallet balance covers expected conversions (auto-draw at conversion time)", async () => {
  // No explicit allocate step under the wallet-first model — placeHold
  // pulls from the wallet when a conversion lands. Just sanity-check the
  // wallet balance is sufficient for the planned conversions.
  const needed = CPA_CENTS * NUM_CONVERSIONS;
  const wallet = await getWalletBalance(state.advertiser!.apiKey);
  expect(wallet.availableCents).toBeGreaterThanOrEqual(needed);
});

test("2.5 confirm tracking and activate campaign", async () => {
  await confirmTracking(state.advertiser!.apiKey, state.testTrackingCode!);
  await activateCampaign(state.advertiser!.apiKey, state.campaignId!);
});

// ═══════════════════════════════════════════════════════════════════════
// 3. AFFILIATE SETUP & CONVERSION
// ═══════════════════════════════════════════════════════════════════════

test("3.1 affiliate registers with BYOW + external CDP-managed receiving address", async () => {
  // The affiliate "owns" an external address — we model it with a second CDP account
  // that the platform does NOT control logically (it represents the affiliate's own wallet).
  const receiver = await cdp.evm.getOrCreateAccount({
    name: `e2e-aff-recv-${RUN_ID}`,
  });
  state.affiliateReceivingAddress = receiver.address as `0x${string}`;

  state.affiliate = await registerAgent(
    `USDC Affiliate ${RUN_ID}`,
    "AFFILIATE",
    `e2e-usdc-aff-${RUN_ID}@test.regatta.dev`,
    {
      profile: {
        audienceSize: 5_000,
        channels: ["blog"],
        contentType: "review",
        audienceGeo: "US",
      },
    }
  );
  await verifyAgentEmail(state.affiliate.agentId);
  // No wallet init step for affiliates — they provide their chain address
  // directly in the payout request.
});

test("3.2 affiliate applies to campaign (OPEN enrollment auto-approves)", async () => {
  const result = await applyToCampaign(
    state.affiliate!.apiKey,
    state.campaignId!
  );
  expect(result.status).toBe("APPROVED");
  state.trackingCode = result.trackingCode;
});

test("3.3 affiliate drives clicks + conversions", async () => {
  for (let i = 0; i < NUM_CONVERSIONS; i++) {
    const tr = await followTrackingLink(state.trackingCode!);
    expect(tr.ref).toBeTruthy();
    const result = await firePostback(
      state.advertiser!.apiKey,
      tr.ref!,
      `usdc-purchase-${RUN_ID}-${i}`,
      "PURCHASE",
      500
    );
    expect(result.leadStatus).toBe("VERIFIED");
    expect(result.payoutCents).toBe(CPA_CENTS);
  }
});

test("3.4 affiliate wallet credited net of 5% platform fee", async () => {
  const wallet = await getWalletBalance(state.affiliate!.apiKey);
  expect(wallet.availableCents).toBe(EXPECTED_AFFILIATE_CENTS);
});

// ═══════════════════════════════════════════════════════════════════════
// 4. CRYPTO PAYOUT (real onchain USDC transfer)
// ═══════════════════════════════════════════════════════════════════════

test("4.1 fund platform hot wallet via CDP faucet (so it can pay affiliates)", async () => {
  test.setTimeout(120_000);
  const owner = await cdp.evm.getOrCreateAccount({
    name: PLATFORM_HOT_OWNER_ACCOUNT_NAME,
  });
  const platformHot = await cdp.evm.getOrCreateSmartAccount({
    name: PLATFORM_HOT_ACCOUNT_NAME,
    owner,
  });
  const platformAddress = platformHot.address as `0x${string}`;

  const usdcBefore = await usdcBalance(platformAddress);
  // Need at least the affiliate payout in base units (6 decimals) = cents * 10_000
  const needed = BigInt(EXPECTED_AFFILIATE_CENTS) * 10_000n;
  if (usdcBefore < needed) {
    await cdp.evm.requestFaucet({
      address: platformAddress,
      network: "base-sepolia",
      token: "usdc",
    });
    await waitForUsdcCredit(platformAddress, usdcBefore);
  }

  // Gas: need a tiny amount of Sepolia ETH. Faucet top-up is idempotent-ish; request anyway.
  const ethBal = await viemClient!.getBalance({ address: platformAddress });
  if (ethBal < 1_000_000_000_000_000n) {
    // < 0.001 ETH
    await cdp.evm.requestFaucet({
      address: platformAddress,
      network: "base-sepolia",
      token: "eth",
    });
  }
});

test("4.2 affiliate requests CRYPTO payout for full balance", async () => {
  const result = await requestPayout(
    state.affiliate!.apiKey,
    EXPECTED_AFFILIATE_CENTS,
    "CRYPTO",
    { chainAddress: state.affiliateReceivingAddress! }
  );
  expect(result.payoutId).toBeTruthy();
  expect(result.status).toBe("PENDING");
  state.payoutId = result.payoutId;
});

test("4.3 platform sends payout → real USDC onchain transfer", async () => {
  test.setTimeout(180_000);
  const receiverBefore = await usdcBalance(state.affiliateReceivingAddress!);

  const { status, json } = await api(
    "POST",
    "/api/test/process-payout",
    { payoutRequestId: state.payoutId }
  );
  expect(status).toBe(200);
  expect(json.ok, `payout failed: ${JSON.stringify(json)}`).toBe(true);
  expect(json.data.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  state.payoutTxHash = json.data.txHash;

  const receiverAfter = await waitForUsdcCredit(
    state.affiliateReceivingAddress!,
    receiverBefore
  );
  expect(receiverAfter - receiverBefore).toBe(BigInt(EXPECTED_AFFILIATE_CENTS) * 10_000n);
});

test("4.4 payout marked COMPLETED and affiliate wallet zeroed", async () => {
  const payouts = await listPayouts(state.affiliate!.apiKey);
  const payout = payouts.find((p: { id: string }) => p.id === state.payoutId);
  expect(payout?.status).toBe("COMPLETED");

  const wallet = await getWalletBalance(state.affiliate!.apiKey);
  expect(wallet.availableCents).toBe(0);
});
