import type { PaymentAsset } from "../core/types.js";

/** Canonical token metadata used in x402 v2 `accepts[]`. */
export interface TokenInfo {
  asset: PaymentAsset;
  symbol: PaymentAsset;
  network: string;
  chainId: string;
  address: string;
  decimals: number;
  name: string;
  version: string;
}

/** BSC mainnet addresses from Binance Skills Hub (agentic wallet). */
export const BSC_TOKENS: Record<PaymentAsset, TokenInfo> = {
  USDT: {
    asset: "USDT",
    symbol: "USDT",
    network: "eip155:56",
    chainId: "56",
    address: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    name: "Tether USD",
    version: "1",
  },
  USDC: {
    asset: "USDC",
    symbol: "USDC",
    network: "eip155:56",
    chainId: "56",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    name: "USD Coin",
    version: "2",
  },
  U: {
    asset: "U",
    symbol: "U",
    network: "eip155:56",
    chainId: "56",
    address: "0xcE24439F2D9C6a2289F741120FE202248B666666",
    decimals: 18,
    name: "U",
    version: "1",
  },
  USD1: {
    asset: "USD1",
    symbol: "USD1",
    network: "eip155:56",
    chainId: "56",
    address: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
    decimals: 18,
    name: "USD1",
    version: "1",
  },
};

export function tokenInfo(asset: PaymentAsset): TokenInfo {
  return BSC_TOKENS[asset];
}

export function toAtomic(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`invalid amount ${amount}`);
  }
  const [whole, frac = ""] = amount.toFixed(decimals).split(".");
  return BigInt(whole + frac.padEnd(decimals, "0").slice(0, decimals)).toString();
}

export function fromAtomic(atomic: string, decimals: number): number {
  const s = atomic.replace(/^0+/, "") || "0";
  if (s.length <= decimals) {
    return Number(`0.${s.padStart(decimals, "0")}`);
  }
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals);
  return Number(`${whole}.${frac}`);
}
