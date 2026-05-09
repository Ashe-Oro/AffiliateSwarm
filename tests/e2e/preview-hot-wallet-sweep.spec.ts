/**
 * Preview hot-wallet sweep E2E.
 *
 * Exercises the production-like preview cron path:
 *   1. Advertiser receives on-chain USDC at their deposit address.
 *   2. detect-deposits credits the advertiser wallet, and the dashboard shows it.
 *   3. sweep moves the deposit-address USDC into the platform hot wallet.
 *   4. Conversions debit the advertiser wallet and allocate affiliate commission.
 *   5. Affiliate requests a CRYPTO payout.
 *   6. process-payouts executes the payout from the hot wallet.
 *
 * Requires the target deployment to have ENABLE_TEST_ROUTES=1 for email
 * verification and mock landing, plus the runner env:
 *   BASE_URL=<preview url>
 *   CHAIN_NETWORK=base-sepolia
 *   BASE_RPC_URL=<Base Sepolia RPC>
 *   CDP_API_KEY_ID, CDP_API_KEY_PRIVATE_KEY or CDP_API_KEY_SECRET
 *   CDP_WALLET_SECRET
 *   CRON_SECRET=<preview cron secret>
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
  loginViaBrowser,
  MOCK_LANDING_URL,
} from "./helpers";
import {
  PLATFORM_HOT_ACCOUNT_NAME,
  PLATFORM_HOT_OWNER_ACCOUNT_NAME,
} from "../../src/lib/chain/cdp";

const BASE_URL = process.env.BASE_URL || "http://localhost:3099";
const IS_SEPOLIA =
  (process.env.CHAIN_NETWORK || "").toLowerCase() === "base-sepolia";
const HAS_CDP =
  !!process.env.CDP_API_KEY_ID &&
  !!(process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY) &&
  !!process.env.CDP_WALLET_SECRET;
const HAS_REQUIRED_ENV =
  IS_SEPOLIA &&
  HAS_CDP &&
  !!process.env.BASE_RPC_URL &&
  !!process.env.CRON_SECRET;

const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const RUN_ID = Date.now();
const CPA_CENTS = 100;
const NUM_CONVERSIONS = 2;
const TOTAL_DEPOSIT_CENTS = CPA_CENTS * NUM_CONVERSIONS;
const PLATFORM_FEE_PER_CONVERSION_CENTS = Math.ceil(CPA_CENTS * 0.05);
const EXPECTED_AFFILIATE_CENTS =
  (CPA_CENTS - PLATFORM_FEE_PER_CONVERSION_CENTS) * NUM_CONVERSIONS;
const EXPECTED_AFFILIATE_USDC = BigInt(EXPECTED_AFFILIATE_CENTS) * 10_000n;

test.describe.configure({ mode: "serial" });
test.skip(
  !HAS_REQUIRED_ENV,
  "preview hot-wallet sweep E2E requires Base Sepolia, CDP credentials, BASE_RPC_URL, and CRON_SECRET"
);

const cdp = HAS_REQUIRED_ENV
  ? new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret:
        process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY!,
      walletSecret: process.env.CDP_WALLET_SECRET!,
    })
  : null;

const viemClient = HAS_REQUIRED_ENV
  ? createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_RPC_URL!),
    })
  : null;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function usdcBalance(address: `0x${string}`): Promise<bigint> {
  return (await viemClient!.readContract({
    address: USDC_SEPOLIA,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
}

async function waitForUsdcIncrease(
  address: `0x${string}`,
  startingBalance: bigint,
  timeoutMs = 120_000
): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await usdcBalance(address);
    if (current > startingBalance) return current;
    await sleep(3_000);
  }
  throw new Error(
    `USDC balance for ${address} did not increase within ${timeoutMs}ms`
  );
}

async function cronGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (res.status !== 200) {
    throw new Error(`Cron ${path} failed: ${res.status} ${text}`);
  }
  return json;
}

async function waitForWalletCredit(apiKey: string, minAvailableCents: number) {
  const deadline = Date.now() + 120_000;
  let lastDetectResult: any = null;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      lastDetectResult = await cronGet("/api/cron/detect-deposits");
    } catch (err) {
      lastError = err;
    }

    const wallet = await getWalletBalance(apiKey);
    if (wallet.availableCents >= minAvailableCents) {
      return { wallet, detectResult: lastDetectResult };
    }

    await sleep(4_000);
  }

  const detail =
    lastError instanceof Error ? lastError.message : JSON.stringify(lastError);
  throw new Error(
    `Advertiser wallet was not credited to ${minAvailableCents} cents. ` +
      `lastDetect=${JSON.stringify(lastDetectResult)} lastError=${detail}`
  );
}

async function getPlatformHotWalletAddress(): Promise<`0x${string}`> {
  const owner = await cdp!.evm.getOrCreateAccount({
    name: PLATFORM_HOT_OWNER_ACCOUNT_NAME,
  });
  const platformHot = await cdp!.evm.getOrCreateSmartAccount({
    name: PLATFORM_HOT_ACCOUNT_NAME,
    owner,
  });
  return platformHot.address as `0x${string}`;
}

test("advertiser deposit is credited, swept to hot wallet, then commission and crypto payout complete", async ({
  page,
}) => {
  test.setTimeout(7 * 60_000);

  const advertiser =
    await test.step("register advertiser with deposit address", async () => {
      const result = await registerAgent(
        `Preview Sweep Advertiser ${RUN_ID}`,
        "ADVERTISER",
        `preview-sweep-adv-${RUN_ID}@test.affiliateswarm.dev`
      );
      await verifyAgentEmail(result.agentId);
      expect(result.depositAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      return result;
    });

  const affiliate =
    await test.step("register affiliate and receiving address", async () => {
      const result = await registerAgent(
        `Preview Sweep Affiliate ${RUN_ID}`,
        "AFFILIATE",
        `preview-sweep-aff-${RUN_ID}@test.affiliateswarm.dev`,
        {
          profile: {
            audienceSize: 10_000,
            channels: ["blog"],
            contentType: "review",
            audienceGeo: "US",
          },
        }
      );
      await verifyAgentEmail(result.agentId);
      return result;
    });

  const receiver = await cdp!.evm.getOrCreateAccount({
    name: `preview-sweep-receiver-${RUN_ID}`,
  });
  const receiverAddress = receiver.address as `0x${string}`;
  const depositAddress = advertiser.depositAddress as `0x${string}`;

  const campaign =
    await test.step("create low-value CPA campaign for faucet-sized funding", async () => {
      return createCampaign(advertiser.apiKey, {
        name: `Preview Sweep CPA ${RUN_ID}`,
        description: "Preview hot-wallet sweep e2e",
        compensationModel: "CPA",
        payoutPerUnitCents: CPA_CENTS,
        budgetCents: TOTAL_DEPOSIT_CENTS,
        landingUrl: MOCK_LANDING_URL,
        holdingPeriodDays: 0,
        enrollmentPolicy: "OPEN",
      });
    });

  await test.step("fund advertiser deposit address with Base Sepolia USDC", async () => {
    for (let i = 0; i < NUM_CONVERSIONS; i++) {
      const before = await usdcBalance(depositAddress);
      const { transactionHash } = await cdp!.evm.requestFaucet({
        address: depositAddress,
        network: "base-sepolia",
        token: "usdc",
      });
      expect(transactionHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      await waitForUsdcIncrease(depositAddress, before);
    }
  });

  await test.step("detect deposits and show advertiser wallet credit before sweep", async () => {
    const { wallet, detectResult } = await waitForWalletCredit(
      advertiser.apiKey,
      TOTAL_DEPOSIT_CENTS
    );
    expect(detectResult?.ok).toBe(true);
    expect(wallet.availableCents).toBe(TOTAL_DEPOSIT_CENTS);

    const { status, json } = await api(
      "GET",
      "/api/v1/me",
      undefined,
      advertiser.apiKey
    );
    expect(status).toBe(200);
    expect(json.data.wallet.availableCents).toBe(TOTAL_DEPOSIT_CENTS);
    expect(json.data.wallet.depositAddress).toBe(depositAddress);

    await loginViaBrowser(page, advertiser.apiKey, "/dashboard/wallet");
    await expect(page).toHaveURL(/\/dashboard\/wallet/);
    await expect(
      page.getByText(formatCents(TOTAL_DEPOSIT_CENTS)).first()
    ).toBeVisible();
  });

  const hotWalletAddress = await getPlatformHotWalletAddress();

  await test.step("sweep deposit-address USDC into platform hot wallet", async () => {
    const depositBeforeSweep = await usdcBalance(depositAddress);
    const hotBeforeSweep = await usdcBalance(hotWalletAddress);

    const sweepResult = await cronGet("/api/cron/sweep");
    expect(sweepResult.ok).toBe(true);

    const depositAfterSweep = await usdcBalance(depositAddress);
    const hotAfterSweep = await usdcBalance(hotWalletAddress);

    if (depositBeforeSweep > 0n) {
      expect(depositAfterSweep).toBeLessThan(depositBeforeSweep);
      expect(hotAfterSweep - hotBeforeSweep).toBeGreaterThanOrEqual(
        depositBeforeSweep - depositAfterSweep
      );
    }

    expect(hotAfterSweep).toBeGreaterThanOrEqual(EXPECTED_AFFILIATE_USDC);
  });

  let trackingCode = "";

  await test.step("activate campaign and enroll affiliate", async () => {
    await confirmTracking(advertiser.apiKey, campaign.testTrackingCode);
    await activateCampaign(advertiser.apiKey, campaign.campaignId);

    const enrollment = await applyToCampaign(
      affiliate.apiKey,
      campaign.campaignId
    );
    expect(enrollment.status).toBe("APPROVED");
    trackingCode = enrollment.trackingCode;
  });

  await test.step("trigger successful commissions from advertiser postbacks", async () => {
    for (let i = 0; i < NUM_CONVERSIONS; i++) {
      const click = await followTrackingLink(trackingCode);
      expect(click.ref).toBe(trackingCode);

      const conversion = await firePostback(
        advertiser.apiKey,
        click.ref!,
        `preview-sweep-conv-${RUN_ID}-${i}`,
        "PURCHASE",
        500
      );
      expect(conversion.created).toBe(true);
      expect(conversion.leadStatus).toBe("VERIFIED");
      expect(conversion.payoutCents).toBe(CPA_CENTS);
    }

    const affiliateWallet = await getWalletBalance(affiliate.apiKey);
    expect(affiliateWallet.availableCents).toBe(EXPECTED_AFFILIATE_CENTS);

    const advertiserWallet = await getWalletBalance(advertiser.apiKey);
    expect(advertiserWallet.availableCents).toBe(0);

    const { status, json } = await api(
      "GET",
      `/api/v1/campaigns/${campaign.campaignId}`,
      undefined,
      advertiser.apiKey
    );
    expect(status).toBe(200);
    expect(json.data.budgetSpentCents).toBe(TOTAL_DEPOSIT_CENTS);
    expect(json.data.escrowAccount.totalReleasedCents).toBe(
      TOTAL_DEPOSIT_CENTS
    );
  });

  let payoutId = "";

  await test.step("affiliate requests crypto payout for allocated commission", async () => {
    const payout = await requestPayout(
      affiliate.apiKey,
      EXPECTED_AFFILIATE_CENTS,
      "CRYPTO",
      { chainAddress: receiverAddress }
    );
    expect(payout.status).toBe("PENDING");
    expect(payout.amountCents).toBe(EXPECTED_AFFILIATE_CENTS);
    payoutId = payout.payoutId;

    const wallet = await getWalletBalance(affiliate.apiKey);
    expect(wallet.availableCents).toBe(0);
    expect(wallet.pendingCents).toBe(EXPECTED_AFFILIATE_CENTS);
  });

  await test.step("process-payouts cron executes payout from hot wallet", async () => {
    const receiverBefore = await usdcBalance(receiverAddress);
    const hotBeforePayout = await usdcBalance(hotWalletAddress);

    const processResult = await cronGet("/api/cron/process-payouts");
    expect(processResult.ok).toBe(true);
    expect(processResult.total).toBeGreaterThanOrEqual(1);

    const receiverAfter = await waitForUsdcIncrease(
      receiverAddress,
      receiverBefore
    );
    expect(receiverAfter - receiverBefore).toBe(EXPECTED_AFFILIATE_USDC);

    const hotAfterPayout = await usdcBalance(hotWalletAddress);
    expect(hotBeforePayout - hotAfterPayout).toBeGreaterThanOrEqual(
      EXPECTED_AFFILIATE_USDC
    );

    const payouts = await listPayouts(affiliate.apiKey);
    const payout = payouts.find((p: { id: string }) => p.id === payoutId);
    expect(payout?.status).toBe("COMPLETED");

    const wallet = await getWalletBalance(affiliate.apiKey);
    expect(wallet.availableCents).toBe(0);
    expect(wallet.pendingCents).toBe(0);
  });
});
