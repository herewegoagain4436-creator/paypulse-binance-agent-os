/**
 * Explainable payment rationales — template rules, no LLM required.
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
    ? ` Buyer seed USDT=${opts.settlement.buyerBalanceUsdt}, reserved+filled daily≈$${(opts.settlement.dailySpendUsedUsd).toFixed(2)}, left≈$${opts.settlement.dailySpendLeftUsd}.`
    : "";
  return (
    `${opts.fromAgentId} pays ${opts.toAgentId} ${money(opts.amount, opts.asset)} for ${svc} ` +
    `via x402 (HTTP 402 → preview → sign → replay).${bal}`
  );
}

export function explainWhyReject(reasons: string[]): string {
  if (!reasons.length) return "Rejected with no detailed reasons.";
  return `Rejected because: ${reasons.join("; ")}.`;
}

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
  if (payment.resourceUrl) factors.push(`resource=${payment.resourceUrl}`);
  if (payment.payTo) factors.push(`payTo=${payment.payTo}`);
  if (payment.txHash) factors.push(`txHash=${payment.txHash}`);
  if (payment.facilitator) factors.push(`facilitator=${payment.facilitator}`);
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
        "Risk cleared; confirm gate is on. Confirm to sign the x402 payment. Not a live fill yet.";
      break;
    case "PENDING":
    case "QUOTED":
      decision = "pending";
      headline = `${payment.status} — ${payment.amount} ${payment.asset} (honest live/path status)`;
      outcome =
        payment.status === "PENDING" && payment.stage === "settle"
          ? "Live x402 replay did not unlock the resource (needs B402 merchant verify/settle or a signed-in baw session). Not CONFIRMED_PAPER."
          : "Payment workflow in progress (402 quote / preview). Settlement not claimed as filled.";
      break;
    case "DELIVERED":
    case "CONFIRMED_PAPER":
      decision = "pay";
      headline = `PAPER DELIVERED — ${payment.amount} ${payment.asset}`;
      outcome =
        "Local HMAC facilitator verified the PAYMENT-SIGNATURE and unlocked the resource. Not a live Binance on-chain payment.";
      break;
    case "SETTLED":
      decision = "pay";
      headline = `SETTLED — ${payment.amount} ${payment.asset}`;
      outcome = payment.txHash
        ? `On-chain/wallet settle recorded txHash=${payment.txHash}.`
        : "Marked settled with a wallet PAYMENT-SIGNATURE.";
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
  const delivered = opts.payments.filter((p) => p.delivery).length;
  return [
    `Mode=${opts.mode}. A2A workflow attempts=${opts.attemptCount}; fills=${opts.successCount}; rejected=${opts.rejectedCount}; pending-ish=${pending}; delivered=${delivered}.`,
    "Story: HTTP 402 → preview → sign → replay; MCP is context only.",
    "Documented x402 daily default ~$20 — labeled default, not a guarantee. Live quota from baw wallet settings when signed in.",
    "Rules rationales — no LLM required.",
  ].join(" ");
}
