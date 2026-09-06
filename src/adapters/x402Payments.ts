/**
 * Binance x402 programmable payments adapter (paper/mock default).
 *
 * Product page: https://www.binance.com/binancex402
 * Documented default daily cap: $20 / day — labeled as documented default, NOT a guarantee.
 * Confirm live quotas in Binance App / wallet settings.
 *
 * No withdrawals. Paper/sim settles locally; mock path is explicitly labeled.
 */
import { envNum, envStr } from "../core/env.js";
import type {
  PaymentIntent,
  PaymentQuote,
  PaymentRecord,
  PaymentStatus,
} from "../core/types.js";
import { X402_DOCUMENTED_DAILY_CAP_USD } from "../core/risk.js";

export const X402_URL = envStr(
  "BINANCE_X402_URL",
  "https://www.binance.com/binancex402"
);

export type AdapterMode = "paper" | "mock" | "live";

export interface X402AdapterResult<T> {
  data: T;
  usedMock: boolean;
  label: string;
  endpoint: string;
  documentedDailyCapUsd: number;
}

function modeFromEnv(): AdapterMode {
  const m = envStr("PAYPULSE_MODE", "paper").toLowerCase();
  if (m === "live" || m === "mock" || m === "paper") return m;
  return "paper";
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Probe x402 page reachability. Live settlement needs wallet/OAuth host —
 * bare fetch rarely equals a real payment rail, so we fall back to paper/mock.
 */
async function tryX402Reachable(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
      redirect: "follow",
    });
    return res.ok || res.status === 301 || res.status === 302;
  } catch {
    return false;
  }
}

export class X402PaymentsAdapter {
  readonly mode: AdapterMode;
  readonly endpoint: string;
  readonly documentedDailyCapUsd: number;
  private lastLabel = "PAPER SIM — local x402-style settlement (not live Binance)";
  private lastUsedMock = false;

  constructor(opts?: { mode?: AdapterMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.endpoint = X402_URL;
    this.documentedDailyCapUsd = envNum(
      "X402_DOCUMENTED_DAILY_CAP_USD",
      X402_DOCUMENTED_DAILY_CAP_USD
    );
  }

  status(): X402AdapterResult<null> {
    return {
      data: null,
      usedMock: this.lastUsedMock,
      label: this.lastLabel,
      endpoint: this.endpoint,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
    };
  }

  async createIntent(input: {
    fromAgentId: string;
    toAgentId: string;
    amount: number;
    asset: "USDT" | "USDC";
    memo: string;
    serviceId?: string;
  }): Promise<X402AdapterResult<PaymentIntent>> {
    const intent: PaymentIntent = {
      id: uid("intent"),
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      amount: input.amount,
      asset: input.asset,
      memo: input.memo,
      serviceId: input.serviceId,
      createdAt: new Date().toISOString(),
    };
    this.lastUsedMock = false;
    this.lastLabel = "PAPER SIM — payment intent created locally (x402-style)";
    return {
      data: intent,
      usedMock: false,
      label: this.lastLabel,
      endpoint: this.endpoint,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
    };
  }

  async quote(intent: PaymentIntent): Promise<X402AdapterResult<PaymentQuote>> {
    const feeUsd = Math.round(intent.amount * 0.001 * 10000) / 10000; // 0.1% paper fee
    const quote: PaymentQuote = {
      intentId: intent.id,
      quoteId: uid("quote"),
      amount: intent.amount,
      asset: intent.asset,
      feeUsd,
      totalUsd: intent.amount + feeUsd,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      rail: "x402",
      label: "PAPER SIM — x402-style quote (not live)",
    };
    this.lastUsedMock = false;
    this.lastLabel = quote.label;
    return {
      data: quote,
      usedMock: false,
      label: this.lastLabel,
      endpoint: this.endpoint,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
    };
  }

  /**
   * Settle after risk + confirm. Paper fills locally.
   * Live attempts probe; on failure returns labeled MOCK (never silent live claim).
   */
  async settle(
    intent: PaymentIntent,
    quote: PaymentQuote,
    opts: { confirmed: boolean; requireConfirm: boolean }
  ): Promise<X402AdapterResult<{ status: PaymentStatus; settledAt?: string; note: string }>> {
    if (opts.requireConfirm && !opts.confirmed) {
      this.lastUsedMock = false;
      this.lastLabel = "AWAITING_CONFIRM — require confirm is on";
      return {
        data: { status: "AWAITING_CONFIRM", note: "confirmation required before settle" },
        usedMock: false,
        label: this.lastLabel,
        endpoint: this.endpoint,
        documentedDailyCapUsd: this.documentedDailyCapUsd,
      };
    }

    if (this.mode === "paper") {
      this.lastUsedMock = false;
      this.lastLabel = "PAPER SIM — x402 settle (local ledger; not live Binance)";
      return {
        data: {
          status: "CONFIRMED_PAPER",
          settledAt: new Date().toISOString(),
          note: `paper settle ${intent.amount} ${intent.asset} via x402-style rail; documented daily cap $${this.documentedDailyCapUsd} (default, not guarantee)`,
        },
        usedMock: false,
        label: this.lastLabel,
        endpoint: this.endpoint,
        documentedDailyCapUsd: this.documentedDailyCapUsd,
      };
    }

    if (this.mode === "mock") {
      this.lastUsedMock = true;
      this.lastLabel = "MOCK — explicit mock settle; not live Binance x402";
      return {
        data: {
          status: "SUBMITTED_MOCK",
          settledAt: new Date().toISOString(),
          note: "MOCK labeled settle",
        },
        usedMock: true,
        label: this.lastLabel,
        endpoint: this.endpoint,
        documentedDailyCapUsd: this.documentedDailyCapUsd,
      };
    }

    // live attempt — usually unavailable in-process without wallet OAuth
    const reachable = await tryX402Reachable(this.endpoint);
    if (!reachable) {
      this.lastUsedMock = true;
      this.lastLabel =
        "MOCK — live x402 unreachable in-process; not a live Binance payment";
      return {
        data: {
          status: "SUBMITTED_MOCK",
          settledAt: new Date().toISOString(),
          note: "fell back to MOCK after live probe failed",
        },
        usedMock: true,
        label: this.lastLabel,
        endpoint: this.endpoint,
        documentedDailyCapUsd: this.documentedDailyCapUsd,
      };
    }

    // Even if page is reachable, we do not invent live settlement without wallet auth
    this.lastUsedMock = true;
    this.lastLabel =
      "MOCK — x402 page reachable but no wallet OAuth in-process; labeled MOCK (not live)";
    return {
      data: {
        status: "SUBMITTED_MOCK",
        settledAt: new Date().toISOString(),
        note: `quote ${quote.quoteId} would need Binance wallet confirm; MOCK only`,
      },
      usedMock: true,
      label: this.lastLabel,
      endpoint: this.endpoint,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
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
      usedMock: false,
      mockLabel: "PENDING — x402-style intent",
    };
  }
}
