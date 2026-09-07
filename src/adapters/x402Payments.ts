/**
 * x402 buyer adapter.
 *
 * Paper/mock: sign a local HMAC and replay to the in-process seller (full 402 → deliver).
 * Live: parse a real HTTP 402, optionally `baw x402-payment preview/sign`, replay.
 * Live never treats a marketing-page GET or paper HMAC as a filled payment.
 */
import { envNum, envStr, modeFromEnv, type AdapterMode } from "../core/env.js";
import { uid } from "../core/id.js";
import { X402_DOCUMENTED_DAILY_CAP_USD } from "../core/risk.js";
import type {
  FacilitatorKind,
  PaymentAsset,
  PaymentIntent,
  PaymentQuote,
  PaymentRecord,
  PaymentStatus,
  PreviewOption,
  ResourceDelivery,
} from "../core/types.js";
import { pickAccept, type X402PaymentRequired } from "../protocol/x402.js";
import { signPaper } from "../protocol/paperSign.js";
import { tokenInfo } from "../protocol/tokens.js";
import { paymentRequiredFor, serveResource, serviceById } from "../seller/resources.js";
import { previewX402, signX402 } from "./agenticWallet.js";

export const X402_PRODUCT_URL = envStr(
  "BINANCE_X402_URL",
  "https://www.binance.com/binancex402"
);

export interface X402AdapterResult<T> {
  data: T;
  usedMock: boolean;
  label: string;
  endpoint: string;
  documentedDailyCapUsd: number;
  facilitator?: FacilitatorKind;
}

function feeUsd(amount: number): number {
  return Math.round(amount * 0.001 * 10000) / 10000;
}

export class X402PaymentsAdapter {
  readonly mode: AdapterMode;
  readonly productUrl: string;
  readonly documentedDailyCapUsd: number;
  private lastLabel = "LIVE x402 — awaiting 402 quote / wallet sign";
  private lastUsedMock = false;
  private lastFacilitator: FacilitatorKind = "none";

  constructor(opts?: { mode?: AdapterMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.productUrl = X402_PRODUCT_URL;
    this.documentedDailyCapUsd = envNum(
      "X402_DOCUMENTED_DAILY_CAP_USD",
      X402_DOCUMENTED_DAILY_CAP_USD
    );
    if (this.mode === "paper") {
      this.lastLabel = "PAPER — local HMAC facilitator over x402 v2 402 bodies";
      this.lastFacilitator = "paper-hmac";
    } else if (this.mode === "mock") {
      this.lastLabel = "MOCK — explicit mock x402 path; not live Binance";
      this.lastUsedMock = true;
      this.lastFacilitator = "paper-hmac";
    }
  }

  status(): X402AdapterResult<null> {
    return {
      data: null,
      usedMock: this.lastUsedMock,
      label: this.lastLabel,
      endpoint: this.productUrl,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
      facilitator: this.lastFacilitator,
    };
  }

  createIntent(input: {
    fromAgentId: string;
    toAgentId: string;
    amount: number;
    asset: PaymentAsset;
    memo: string;
    serviceId?: string;
    resourceUrl: string;
  }): X402AdapterResult<PaymentIntent> {
    const intent: PaymentIntent = {
      id: uid("intent"),
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      amount: input.amount,
      asset: input.asset,
      memo: input.memo,
      serviceId: input.serviceId,
      resourceUrl: input.resourceUrl,
      createdAt: new Date().toISOString(),
    };
    this.lastUsedMock = this.mode === "mock";
    this.lastLabel =
      this.mode === "paper"
        ? "PAPER — intent against local x402 resource"
        : this.mode === "mock"
          ? "MOCK — payment intent"
          : "LIVE — intent prepared; quote is an HTTP 402 from the resource";
    return {
      data: intent,
      usedMock: this.lastUsedMock,
      label: this.lastLabel,
      endpoint: this.productUrl,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
      facilitator: this.lastFacilitator,
    };
  }

  quoteFrom402(
    intent: PaymentIntent,
    required: X402PaymentRequired
  ): X402AdapterResult<PaymentQuote> {
    const accept = pickAccept(required, intent.asset);
    if (!accept) {
      throw new Error("402 response has no matching accept");
    }
    const token = tokenInfo(intent.asset);
    const quote: PaymentQuote = {
      intentId: intent.id,
      quoteId: uid("quote"),
      amount: intent.amount,
      asset: intent.asset,
      feeUsd: feeUsd(intent.amount),
      totalUsd: intent.amount + feeUsd(intent.amount),
      expiresAt: new Date(Date.now() + (accept.maxTimeoutSeconds ?? 300) * 1000).toISOString(),
      rail: "x402",
      label:
        this.mode === "live"
          ? "LIVE — x402 v2 PaymentRequired (HTTP 402)"
          : this.mode === "paper"
            ? "PAPER — x402 v2 PaymentRequired (local resource)"
            : "MOCK — x402 v2 PaymentRequired",
      resourceUrl: required.resource.url,
      payTo: accept.payTo,
      network: accept.network,
      tokenAddress: accept.asset,
      atomicAmount: accept.amount,
      paymentRequired: required,
    };
    this.lastLabel = quote.label;
    this.lastUsedMock = this.mode === "mock";
    return {
      data: quote,
      usedMock: this.lastUsedMock,
      label: quote.label,
      endpoint: quote.resourceUrl,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
      facilitator: this.lastFacilitator,
    };
  }

  quoteForService(intent: PaymentIntent, serviceId: string): X402AdapterResult<PaymentQuote> {
    const service = serviceById(serviceId);
    if (!service) throw new Error(`unknown service ${serviceId}`);
    const required = paymentRequiredFor(service, {
      amount: intent.amount,
      asset: intent.asset,
    });
    return this.quoteFrom402(intent, required);
  }

  async preview(
    required: X402PaymentRequired
  ): Promise<{ options: PreviewOption[]; paymentId?: string; label: string; facilitator: FacilitatorKind }> {
    if (this.mode === "paper" || this.mode === "mock") {
      const accept = required.accepts[0];
      const token = tokenInfo((accept.extra.paypulseAsset as PaymentAsset) ?? "USDT");
      this.lastFacilitator = "paper-hmac";
      return {
        facilitator: "paper-hmac",
        paymentId: uid("paper-pay"),
        label: "PAPER preview — local HMAC option READY_TO_SIGN",
        options: [
          {
            index: 1,
            status: "READY_TO_SIGN",
            reasons: [],
            scheme: accept.scheme,
            assetTransferMethod: accept.extra.assetTransferMethod,
            tokenSymbol: token.symbol,
            amount: accept.extra.paypulseAsset ?? token.symbol,
            amountUsd: accept.amount,
            payTo: accept.payTo,
            needApproveFirst: false,
          },
        ],
      };
    }

    const live = await previewX402(required);
    if (live.ok) {
      this.lastFacilitator = "baw";
      this.lastLabel = live.label;
      return {
        facilitator: "baw",
        paymentId: live.paymentId,
        options: live.options,
        label: live.label,
      };
    }

    const accept = required.accepts[0];
    this.lastFacilitator = "none";
    this.lastLabel = `${live.label} — showing 402 accept as NOT_SIGNABLE until wallet is ready`;
    return {
      facilitator: "none",
      options: [
        {
          index: 1,
          status: "NOT_SIGNABLE",
          reasons: ["NO_WALLET_ON_CHAIN"],
          scheme: accept.scheme,
          assetTransferMethod: accept.extra.assetTransferMethod,
          tokenSymbol: accept.extra.paypulseAsset ?? "USDT",
          amount: accept.amount,
          amountUsd: "",
          payTo: accept.payTo,
        },
      ],
      label: this.lastLabel,
    };
  }

  async sign(input: {
    intent: PaymentIntent;
    quote: PaymentQuote;
    selectedIndex: number;
    paymentId?: string;
  }): Promise<{
    paymentHeaderName: string;
    paymentHeaderValue: string;
    signatureExpiresAt?: number;
    facilitator: FacilitatorKind;
    label: string;
    txHash?: string;
  }> {
    if (this.mode === "paper" || this.mode === "mock") {
      const header = signPaper({
        resourceUrl: input.quote.resourceUrl,
        amount: input.intent.amount,
        asset: input.intent.asset,
        payTo: input.quote.payTo,
        intentId: input.intent.id,
        exp: Date.now() + 5 * 60_000,
      });
      this.lastFacilitator = "paper-hmac";
      return {
        paymentHeaderName: "PAYMENT-SIGNATURE",
        paymentHeaderValue: header,
        signatureExpiresAt: Math.floor(Date.now() / 1000) + 300,
        facilitator: "paper-hmac",
        label:
          this.mode === "mock"
            ? "MOCK — paper HMAC PAYMENT-SIGNATURE"
            : "PAPER — HMAC PAYMENT-SIGNATURE",
        txHash: `paper-${input.intent.id}`,
      };
    }

    if (!input.paymentId) {
      return Promise.reject(new Error("live sign requires baw paymentId from preview"));
    }
    const signed = await signX402(input.paymentId, input.selectedIndex);
    if (!signed.ok || !signed.paymentHeaderValue) {
      throw new Error(signed.label);
    }
    this.lastFacilitator = "baw";
    return {
      paymentHeaderName: signed.paymentHeaderName ?? "PAYMENT-SIGNATURE",
      paymentHeaderValue: signed.paymentHeaderValue,
      signatureExpiresAt: signed.signatureExpiresAt,
      facilitator: "baw",
      label: signed.label,
      txHash: signed.approveTxHash ?? undefined,
    };
  }

  replay(
    resourcePath: string,
    paymentHeader: string
  ): {
    status: number;
    delivery?: ResourceDelivery;
    txHash?: string;
    note: string;
    paymentStatus: PaymentStatus;
  } {
    const result = serveResource(resourcePath, paymentHeader, this.mode);
    if (result.status === 200) {
      const mime =
        result.headers["content-type"]?.split(";")[0] ?? "application/octet-stream";
      const body =
        typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2);
      let txHash: string | undefined;
      const resp = result.headers["PAYMENT-RESPONSE"];
      if (resp) {
        try {
          const parsed = JSON.parse(Buffer.from(resp, "base64").toString("utf8")) as {
            txHash?: string;
          };
          txHash = parsed.txHash;
        } catch {
          /* ignore */
        }
      }
      const paymentStatus: PaymentStatus =
        this.mode === "mock"
          ? "SUBMITTED_MOCK"
          : this.mode === "paper"
            ? "DELIVERED"
            : "SETTLED";
      this.lastLabel =
        paymentStatus === "DELIVERED"
          ? "PAPER — resource delivered after HMAC verify"
          : paymentStatus === "SUBMITTED_MOCK"
            ? "MOCK — labeled delivery"
            : "LIVE — resource 200 (unexpected without B402 merchant)";
      return {
        status: 200,
        delivery: { mimeType: mime, body, deliveredAt: new Date().toISOString() },
        txHash,
        note: this.lastLabel,
        paymentStatus,
      };
    }

    const err =
      result.body && typeof result.body === "object" && "error" in result.body
        ? String((result.body as { error: string }).error)
        : `resource returned HTTP ${result.status}`;

    if (this.mode === "live") {
      this.lastLabel = `LIVE x402 PENDING — ${err}`;
      return {
        status: result.status,
        note: this.lastLabel,
        paymentStatus: "PENDING",
      };
    }

    this.lastLabel = err;
    return {
      status: result.status,
      note: err,
      paymentStatus: "REJECTED",
    };
  }

  buildPendingRecord(intent: PaymentIntent, requireConfirm: boolean): PaymentRecord {
    const now = new Date().toISOString();
    return {
      id: uid("pay"),
      intentId: intent.id,
      fromAgentId: intent.fromAgentId,
      toAgentId: intent.toAgentId,
      amount: intent.amount,
      asset: intent.asset,
      memo: intent.memo,
      status: "PENDING",
      stage: "intent",
      createdAt: now,
      updatedAt: now,
      requiresConfirm: requireConfirm,
      usedMock: this.mode === "mock",
      resourceUrl: intent.resourceUrl,
      reservedUsd: intent.amount,
      mockLabel:
        this.mode === "live"
          ? "PENDING — LIVE x402 402 flow"
          : "PENDING — x402 402 flow",
    };
  }
}
