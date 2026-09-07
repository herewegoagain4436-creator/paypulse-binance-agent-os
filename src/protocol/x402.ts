import type { PaymentAsset } from "../core/types.js";
import { tokenInfo, toAtomic } from "./tokens.js";

/** x402 v2 resource descriptor (B402 / Skills Hub shape). */
export interface X402ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export interface X402Accept {
  scheme: "exact" | "upto";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: string;
    version: string;
    assetTransferMethod: string;
    signerAddress: string;
    spenderAddress: string;
    facilitator?: string;
    paypulseAsset?: PaymentAsset;
  };
}

export interface X402PaymentRequired {
  x402Version: 2;
  resource: X402ResourceInfo;
  accepts: X402Accept[];
}

export const PAPER_FACILITATOR_ADDRESS =
  "0x0000000000000000000000000000000000000402";

export const PAPER_TRANSFER_METHOD = "paypulse-paper-hmac";

export function buildPaymentRequired(input: {
  resource: X402ResourceInfo;
  amount: number;
  asset: PaymentAsset;
  payTo: string;
  method?: string;
  facilitator?: string;
}): X402PaymentRequired {
  const token = tokenInfo(input.asset);
  const method = input.method ?? PAPER_TRANSFER_METHOD;
  const facilitator = input.facilitator ?? "paypulse-paper";
  return {
    x402Version: 2,
    resource: input.resource,
    accepts: [
      {
        scheme: "exact",
        network: token.network,
        amount: toAtomic(input.amount, token.decimals),
        asset: token.address,
        payTo: input.payTo,
        maxTimeoutSeconds: 300,
        extra: {
          name: token.name,
          version: token.version,
          assetTransferMethod: method,
          signerAddress: PAPER_FACILITATOR_ADDRESS,
          spenderAddress: PAPER_FACILITATOR_ADDRESS,
          facilitator,
          paypulseAsset: input.asset,
        },
      },
    ],
  };
}

export function parsePaymentRequired(body: unknown): X402PaymentRequired | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Partial<X402PaymentRequired>;
  if (raw.x402Version !== 2 || !Array.isArray(raw.accepts) || raw.accepts.length === 0) {
    return null;
  }
  if (!raw.resource || typeof raw.resource.url !== "string") return null;
  return raw as X402PaymentRequired;
}

export function pickAccept(
  req: X402PaymentRequired,
  asset?: PaymentAsset
): X402Accept | undefined {
  if (!asset) return req.accepts[0];
  return (
    req.accepts.find((a) => a.extra?.paypulseAsset === asset) ??
    req.accepts.find((a) => a.extra?.name?.toUpperCase().includes(asset)) ??
    req.accepts[0]
  );
}

export function isPaperMethod(accept: X402Accept): boolean {
  return accept.extra?.assetTransferMethod === PAPER_TRANSFER_METHOD;
}
