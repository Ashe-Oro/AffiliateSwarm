import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

// ---------------------------------------------------------------------------
// Network selection
// ---------------------------------------------------------------------------

type ChainNetwork = "base" | "base-sepolia";

function getNetwork(): ChainNetwork {
  const n = (process.env.CHAIN_NETWORK || "base").toLowerCase();
  if (n !== "base" && n !== "base-sepolia") {
    throw new Error(`Invalid CHAIN_NETWORK "${n}" — must be "base" or "base-sepolia"`);
  }
  return n;
}

export const CHAIN_NETWORK = getNetwork();
export const IS_TESTNET = CHAIN_NETWORK === "base-sepolia";

// CDP network identifier (what @coinbase/cdp-sdk expects for faucet/tx submission)
export const CDP_NETWORK_ID: "base" | "base-sepolia" = CHAIN_NETWORK;

export const VIEM_CHAIN = IS_TESTNET ? baseSepolia : base;
export const BASE_CHAIN_ID = VIEM_CHAIN.id;

/** USDC contract address — differs per network */
export const USDC_ADDRESS: `0x${string}` = IS_TESTNET
  ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e" // Base Sepolia USDC
  : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet USDC

/** Minimal ERC-20 ABI for USDC operations */
export const USDC_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Public client (read-only RPC access — signing happens via CDP)
// ---------------------------------------------------------------------------

function getRpcUrl(): string {
  const url = process.env.BASE_RPC_URL;
  if (!url) {
    throw new Error("BASE_RPC_URL environment variable is not set");
  }
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPublicClient(): any {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: VIEM_CHAIN,
      transport: http(getRpcUrl()),
    });
  }
  return _publicClient;
}
