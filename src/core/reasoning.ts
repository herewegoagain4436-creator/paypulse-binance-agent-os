/**
 * Thin explainable payment rationales — template rules, no LLM required.
 * Answers "why pay" / "why reject" for judges (CLI + dashboard).
 */
import type {
  PaymentAsset,
  PaymentRationale,
  PaymentRecord,
  PaymentStatus,
  ServiceOffer,
  SettlementContext,
} from "./types.js";

function money(n: number, asset?: PaymentAsset): string {
  return asset ? `$${n} ${asset}` : `$${n}`;
}

/** Why this A2A payment was attempted (service / memo / balances). */
export function explainWhyPay(opts: {
  amount: number;
  asset: PaymentAsset;
  memo: string;
  fromAgentId: string;
  toAgentId: string;
  service?: ServiceOffer;
  settlement?: SettlementContext;
}): string {
  const svc = opts.service
    ? `service "${opts.service.title}" (${opts.service.id})`
    : `memo "${opts.memo}"`;
  const bal = opts.settlement
    ? ` Buyer seed USDT=${opts.settlement.buyerBalanceUsdt}, daily left≈$${opts.settlement.dailySpendLeftUsd}.`
    : "";
  return (
    `${opts.fromAgentId} pays ${opts.toAgentId} ${money(opts.amount, opts.asset)} for ${svc} ` +
    `via x402 (intent → quote → confirm → settle).${bal}`
  );
}

/** Why risk / live path rejected or blocked. */
export function explainWhyReject(reasons: string[]): string {
  if (!reasons.length) return "Rejected with no detailed reasons.";
  return `Rejected because: ${reasons.join("; ")}.`;
}

/** Build a structured NL rationale for one payment record. */
export function explainPayment(
  payment: PaymentRecord,
  opts?: {
    service?: ServiceOffer;
    settlement?: SettlementContext;
    riskReasons?: string[];
  }
): PaymentRationale {
  const factors: string[] = [
    `${payment.amount} ${payment.asset}`,
    `stage=${payment.stage}`,
    `status=${payment.status}`,
    `rail=x402`,
  ];
  if (payment.memo) factors.push(`memo=${payment.memo}`);
  if (opts?.service) factors.push(`service=${opts.service.title}`);
  if (opts?.settlement) {
    factors.push(`dailyLeft≈$${opts.settlement.dailySpendLeftUsd}`);
  }
  for (const r of (opts?.riskReasons ?? []).slice(0, 3)) {
    factors.push(r.slice(0, 140));
  }
  if (payment.rejectReason) {
    for (const part of payment.rejectReason.split("; ").slice(0, 3)) {
      if (!factors.includes(part.slice(0, 140))) factors.push(part.slice(0, 140));
    }
  }

  const whyPay = explainWhyPay({
    amount: payment.amount,
    asset: payment.asset,
    memo: payment.memo,
    fromAgentId: payment.fromAgentId,
    toAgentId: payment.toAgentId,
    service: opts?.service,
    settlement: opts?.settlement,
  });

  let decision: PaymentRationale["decision"];
  let headline: string;
  let outcome: string;

  switch (payment.status as PaymentStatus) {
    case "REJECTED":
    case "FAILED":
      decision = "reject";
      headline = `REJECT — ${payment.amount} ${payment.asset} (${payment.fromAgentId} → ${payment.toAgentId})`;
      outcome = explainWhyReject(
        opts?.riskReasons?.length
          ? opts.riskReasons
          : payment.rejectReason
            ? payment.rejectReason.split("; ")
            : [payment.mockLabel ?? "risk or live auth gate"]
      );
      break;
    case "AWAITING_CONFIRM":
      decision = "awaiting_confirm";
      headline = `AWAITING_CONFIRM — ${payment.amount} ${payment.asset}`;
      outcome =
        "Risk cleared; confirm gate is on. Pass confirm=true (or disable REQUIRE_CONFIRM) to proceed to settle. Not a live fill yet.";
      break;
    case "PENDING":
    case "QUOTED":
      decision = "pending";
      headline = `${payment.status} — ${payment.amount} ${payment.asset} (honest live/path status)`;
      outcome =
        payment.status === "PENDING" && payment.stage === "settle"
          ? "Live x402 settle acknowledged as PENDING — awaiting wallet/hub confirm. Not CONFIRMED_PAPER."
          : "Payment workflow in progress (intent/quote). Settlement not claimed as filled.";
      break;
    case "CONFIRMED_PAPER":
      decision = "pay";
      headline = `PAPER PAY — ${payment.amount} ${payment.asset} (explicit paper mode)`;
      outcome =
        "Paper/sim settle on local ledger only. Not a live Binance x402 payment.";
      break;
    case "SUBMITTED_MOCK":
      decision = "pay";
      headline = `MOCK PAY — ${payment.amount} ${payment.asset} (explicit mock mode)`;
      outcome = "Explicit MOCK settle label. Not a live Binance x402 payment.";
      break;
    default:
      decision = "pending";
      headline = `${payment.status} — ${payment.amount} ${payment.asset}`;
      outcome = payment.mockLabel ?? "See ledger label.";
  }

  const narrative = [whyPay, outcome, "Rules rationale — no LLM required."].join(" ");

  return { headline, narrative, factors, decision };
}

/** Short run-level narrative for CLI / dashboard. */
export function explainRunSummary(opts: {
  mode: string;
  payments: PaymentRecord[];
  attemptCount: number;
  rejectedCount: number;
  successCount: number;
}): string {
  const pending = opts.payments.filter(
    (p) => p.status === "PENDING" || p.status === "AWAITING_CONFIRM" || p.status === "QUOTED"
  ).length;
  return [
    `Mode=${opts.mode}. A2A workflow attempts=${opts.attemptCount}; paper/mock fills=${opts.successCount}; rejected=${opts.rejectedCount}; pending-ish=${pending}.`,
    "Story: intent → quote → confirm → settle via x402; MCP for balances/context.",
    "Documented x402 daily default ~$20 — labeled default, not a guarantee.",
    "Rules rationales — no LLM required.",
  ].join(" ");
}
