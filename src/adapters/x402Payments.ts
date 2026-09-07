/**
 * Binance x402 programmable payments adapter.
 *
 * Product page: https://www.binance.com/binancex402
 * Documented default daily cap: $20 / day — labeled as documented default, NOT a guarantee.
 * Confirm live quotas in Binance App / wallet settings.
 *
 * Default: live (PAYPULSE_MODE=live). Paper/mock are explicit opt-in only.
 * Live path returns PENDING / AWAITING_CONFIRM / REJECTED honestly —
 * never silent CONFIRMED_PAPER as live success. No withdrawals.
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
  const m = envStr("PAYPULSE_MODE", "live").toLowerCase();
  if (m === "live" || m === "mock" || m === "paper") return m;
  return "live";
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Probe x402 page reachability. Live settlement needs wallet/OAuth host —
 * bare fetch rarely equals a real payment rail.
 */
async function tryX402Reachable(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
      redirect: "follow",
    });
    return res.ok || res.status === 301 || res.status === 302 || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}

export class X402PaymentsAdapter {
  readonly mode: AdapterMode;
  readonly endpoint: string;
  readonly documentedDailyCapUsd: number;
  private lastLabel = "LIVE x402 — awaiting settle / host confirm (default mode)";
  private lastUsedMock = false;

  constructor(opts?: { mode?: AdapterMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.endpoint = X402_URL;
    this.documentedDailyCapUsd = envNum(
      "X402_DOCUMENTED_DAILY_CAP_USD",
      X402_DOCUMENTED_DAILY_CAP_USD
    );
    if (this.mode === "paper") {
      this.lastLabel = "PAPER SIM (opt-in) — local x402-style settlement (not live Binance)";
    } else if (this.mode === "mock") {
      this.lastLabel = "MOCK (opt-in) — explicit mock x402 path; not live Binance";
    }
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
    this.lastUsedMock = this.mode === "mock";
    if (this.mode === "paper") {
      this.lastLabel = "PAPER SIM — payment intent created locally (x402-style)";
    } else if (this.mode === "mock") {
      this.lastLabel = "MOCK — payment intent (explicit mock mode)";
    } else {
      this.lastLabel = "LIVE — payment intent prepared for x402 rail (settle still needs wallet/host)";
    }
    return {
      data: intent,
      usedMock: this.lastUsedMock,
      label: this.lastLabel,
      endpoint: this.endpoint,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
    };
  }

  async quote(intent: PaymentIntent): Promise<X402AdapterResult<PaymentQuote>> {
    const feeUsd = Math.round(intent.amount * 0.001 * 10000) / 10000; // 0.1% illustrative fee
    const quoteLabel =
      this.mode === "paper"
        ? "PAPER SIM — x402-style quote (not live)"
        : this.mode === "mock"
          ? "MOCK — x402-style quote (not live)"
          : "LIVE — x402-style quote prepared (not a filled payment)";
    const quote: PaymentQuote = {
      intentId: intent.id,
      quoteId: uid("quote"),
      amount: intent.amount,
      asset: intent.asset,
      feeUsd,
      totalUsd: intent.amount + feeUsd,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      rail: "x402",
      label: quoteLabel,
    };
    this.lastUsedMock = this.mode === "mock";
    this.lastLabel = quote.label;
    return {
      data: quote,
      usedMock: this.lastUsedMock,
      label: this.lastLabel,
      endpoint: this.endpoint,
      documentedDailyCapUsd: this.documentedDailyCapUsd,
    };
  }

  /**
   * Settle after risk + confirm.
   * - paper: CONFIRMED_PAPER (local ledger only)
   * - mock: SUBMITTED_MOCK (explicit opt-in)
   * - live: PENDING / AWAITING_CONFIRM / REJECTED — never CONFIRMED_PAPER
   */
  async settle(
    intent: PaymentIntent,
    quote: PaymentQuote,
    opts: { confirmed: boolean; requireConfirm: boolean }
  ): Promise<X402AdapterResult<{ status: PaymentStatus; settledAt?: string; note: string }>> {
    if (opts.requireConfirm && !opts.confirmed) {
      this.lastUsedMock = false;
      this.lastLabel = "AWAITING_CONFIRM — require confirm is on; not settled";
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

    // LIVE — honest statuses only (never CONFIRMED_PAPER / silent mock-as-success)
    const reachable = await tryX402Reachable(this.endpoint);
    if (!reachable) {
      this.lastUsedMock = false;
      this.lastLabel =
        "LIVE x402 REJECTED — wallet/hub unreachable in-process; authenticate via Binance Wallet / MCP host. Not a paper fill.";
      return {
        data: {
          status: "REJECTED",
          note: "LIVE auth/hub required — open Binance x402 / Agentic Wallet. Not a paper or mock fill.",
        },
        usedMock: false,
        label: this.lastLabel,
        endpoint: this.endpoint,
        documentedDailyCapUsd: this.documentedDailyCapUsd,
      };
    }

    this.lastUsedMock = false;
    this.lastLabel = `LIVE x402 PENDING — quote ${quote.quoteId} awaiting wallet/hub confirm; not a filled payment`;
    return {
      data: {
        status: "PENDING",
        note: `LIVE pending confirm for ${intent.amount} ${intent.asset}; documented daily cap $${this.documentedDailyCapUsd} (default, not guarantee). Not CONFIRMED_PAPER.`,
      },
      usedMock: false,
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
      mockLabel:
        this.mode === "live"
          ? "PENDING — LIVE x402-style intent"
          : "PENDING — x402-style intent",
    };
  }
}
