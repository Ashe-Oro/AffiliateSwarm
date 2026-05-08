import { IS_TESTNET } from "./config";

const MAINNET_BASE = "https://basescan.org";
const TESTNET_BASE = "https://sepolia.basescan.org";

export function explorerBaseUrl(): string {
  return IS_TESTNET ? TESTNET_BASE : MAINNET_BASE;
}

export function txUrl(txHash: string): string {
  return `${explorerBaseUrl()}/tx/${txHash}`;
}

export function addressUrl(address: string): string {
  return `${explorerBaseUrl()}/address/${address}`;
}
