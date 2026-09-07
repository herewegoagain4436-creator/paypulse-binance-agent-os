import { envStr, modeFromEnv, type AdapterMode } from "../core/env.js";
import { loadAgents, loadServices } from "../core/agents.js";
import type { PaymentAsset, ServiceOffer } from "../core/types.js";
import {
  buildPaymentRequired,
  parsePaymentRequired,
  type X402PaymentRequired,
} from "../protocol/x402.js";
import { looksLikePaperHeader, verifyPaper } from "../protocol/paperSign.js";
import { renderDelivery } from "./deliver.js";

export interface ResourceResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

function payToFor(service: ServiceOffer): string {
  const agents = loadAgents();
  const seller = agents.find((a) => a.id === service.sellerAgentId);
  const envKey = `PAYPULSE_PAYTO_${service.sellerAgentId.replace(/[^A-Z0-9]+/gi, "_").toUpperCase()}`;
  return envStr(envKey, seller?.payTo?.address ?? "0x8B3a350e2f3E6B9cC6FB10Fd106bA08f08bec5D2");
}

export function serviceByPath(path: string): ServiceOffer | undefined {
  const clean = path.split("?")[0].replace(/\/+$/, "");
  return loadServices().find((s) => s.path === clean || s.path === path);
}

export function serviceById(id: string): ServiceOffer | undefined {
  return loadServices().find((s) => s.id === id);
}

export function resourceUrlFor(service: ServiceOffer, baseUrl?: string): string {
  const base = (baseUrl ?? envStr("PAYPULSE_RESOURCE_BASE", "")).replace(/\/+$/, "");
  return base ? `${base}${service.path}` : service.path;
}

export function paymentRequiredFor(
  service: ServiceOffer,
  opts?: { amount?: number; asset?: PaymentAsset }
): X402PaymentRequired {
  const amount = opts?.amount ?? service.priceUsd;
  const asset = opts?.asset ?? service.asset;
  return buildPaymentRequired({
    resource: {
      url: resourceUrlFor(service),
      description: service.description,
      mimeType: service.mimeType,
    },
    amount,
    asset,
    payTo: payToFor(service),
  });
}

function jsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extra,
  };
}

/**
 * In-process x402 resource.
 * No PAYMENT-SIGNATURE → HTTP 402 with v2 accepts[].
 * Paper HMAC → 200 + payload.
 * Live wallet header without B402 merchant verify → 402 still unpaid (honest).
 */
export function serveResource(
  path: string,
  paymentHeader?: string,
  mode: AdapterMode = modeFromEnv()
): ResourceResult {
  const service = serviceByPath(path);
  if (!service) {
    return {
      status: 404,
      headers: jsonHeaders(),
      body: { error: "unknown resource", path },
    };
  }

  const required = paymentRequiredFor(service);
  if (!paymentHeader) {
    return {
      status: 402,
      headers: {
        ...jsonHeaders(),
        "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(required), "utf8").toString("base64"),
      },
      body: required,
    };
  }

  if (looksLikePaperHeader(paymentHeader)) {
    if (mode === "live") {
      return {
        status: 402,
        headers: jsonHeaders(),
        body: {
          ...required,
          error:
            "LIVE refuses paper HMAC. Opt into PAYPULSE_MODE=paper to settle locally, or replay a B402-verified PAYMENT-SIGNATURE.",
        },
      };
    }
    const verified = verifyPaper(paymentHeader);
    if (!verified.ok) {
      return {
        status: 402,
        headers: jsonHeaders(),
        body: { ...required, error: verified.reason },
      };
    }
    const delivery = renderDelivery(service, {
      amount: verified.payload.amount,
      asset: verified.payload.asset,
    });
    return {
      status: 200,
      headers: {
        "content-type": `${delivery.mimeType}; charset=utf-8`,
        "PAYMENT-RESPONSE": Buffer.from(
          JSON.stringify({
            success: true,
            facilitator: "paypulse-paper",
            txHash: `paper-${verified.payload.intentId}`,
          }),
          "utf8"
        ).toString("base64"),
      },
      body: delivery.mimeType.includes("json") ? JSON.parse(delivery.body) : delivery.body,
    };
  }

  // Wallet / B402-shaped header present but this process is not a B402 merchant.
  return {
    status: 402,
    headers: jsonHeaders(),
    body: {
      ...required,
      error:
        "PAYMENT-SIGNATURE received but on-chain settle needs B402 merchant /verify+/settle (partner credentials). Held as unpaid 402 — not a paper fill.",
      hasPaymentHeader: true,
    },
  };
}

export function decodePaymentRequiredHeader(header: string): X402PaymentRequired | null {
  try {
    return parsePaymentRequired(JSON.parse(Buffer.from(header, "base64").toString("utf8")));
  } catch {
    return parsePaymentRequired((() => {
      try {
        return JSON.parse(header);
      } catch {
        return null;
      }
    })());
  }
}
