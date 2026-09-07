/**
 * A2A payment workflow: intent → quote → confirm → settle via x402.
 * Default mode is live (PAYPULSE_MODE=live). Paper/mock are explicit opt-in.
 * Live settle returns PENDING / AWAITING_CONFIRM / REJECTED — never silent CONFIRMED_PAPER.
 */
import { AgentOsFacade } from "../adapters/agentOsFacade.js";
import { loadAgents, loadServices, getAgent } from "./agents.js";
import { PaymentLedger } from "./ledger.js";
import { explainPayment } from "./reasoning.js";
import { checkPaymentRisk, loadRiskConfig } from "./risk.js";
import type {
  AgentProfile,
  DemoRunResult,
  PaymentRecord,
  ServiceOffer,
  WorkflowResult,
} from "./types.js";

export interface CreatePaymentRequest {
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  asset: "USDT" | "USDC";
  memo: string;
  serviceId?: string;
  /** When requireConfirm is on, pass true to proceed to settle */
  confirm?: boolean;
}

export class PayPulseEngine {
  readonly facade: AgentOsFacade;
  readonly ledger: PaymentLedger;
  agents: AgentProfile[];
  services: ServiceOffer[];

  constructor(opts?: { facade?: AgentOsFacade; agents?: AgentProfile[] }) {
    this.facade = opts?.facade ?? new AgentOsFacade();
    this.ledger = new PaymentLedger();
    this.agents = opts?.agents ?? loadAgents();
    this.services = loadServices();
  }

  private mutateBalances(fromId: string, toId: string, amount: number, asset: "USDT" | "USDC") {
    const buyer = getAgent(fromId, this.agents);
    const seller = getAgent(toId, this.agents);
    if (!buyer || !seller) return;
    if (asset === "USDT") {
      buyer.paperBalanceUsdt = Math.round((buyer.paperBalanceUsdt - amount) * 1e6) / 1e6;
      seller.paperBalanceUsdt = Math.round((seller.paperBalanceUsdt + amount) * 1e6) / 1e6;
    } else {
      buyer.paperBalanceUsdc = Math.round((buyer.paperBalanceUsdc - amount) * 1e6) / 1e6;
      seller.paperBalanceUsdc = Math.round((seller.paperBalanceUsdc + amount) * 1e6) / 1e6;
    }
  }

  private serviceFor(serviceId?: string): ServiceOffer | undefined {
    if (!serviceId) return undefined;
    return this.services.find((s) => s.id === serviceId);
  }

  async runPayment(req: CreatePaymentRequest): Promise<WorkflowResult> {
    const risk = loadRiskConfig();
    const dailyUsed = this.ledger.dailySpendUsd(req.fromAgentId);
    const service = this.serviceFor(req.serviceId);

    const intentRes = await this.facade.x402.createIntent({
      fromAgentId: req.fromAgentId,
      toAgentId: req.toAgentId,
      amount: req.amount,
      asset: req.asset,
      memo: req.memo,
      serviceId: req.serviceId,
    });
    const intent = intentRes.data;

    let record = this.facade.x402.buildPendingRecord(intent, risk.requireConfirm);
    this.ledger.upsert(record);

    const riskCheck = checkPaymentRisk(intent, dailyUsed, risk);
    if (!riskCheck.ok) {
      record = {
        ...record,
        status: "REJECTED",
        stage: "intent",
        updatedAt: new Date().toISOString(),
        rejectReason: riskCheck.reasons.join("; "),
        mockLabel: "REJECTED by risk / documented x402 cap",
      };
      const buyer = getAgent(req.fromAgentId, this.agents);
      const seller = getAgent(req.toAgentId, this.agents);
      const settlement = (
        await this.facade.mcp.getSettlementContext({
          buyerUsdt: buyer?.paperBalanceUsdt ?? 0,
          sellerUsdt: seller?.paperBalanceUsdt ?? 0,
          buyerUsdc: buyer?.paperBalanceUsdc ?? 0,
          sellerUsdc: seller?.paperBalanceUsdc ?? 0,
          dailySpendUsedUsd: dailyUsed,
          dailyCapUsd: Math.min(risk.dailySpendCapUsd, risk.x402DocumentedDailyCapUsd),
        })
      ).data;
      record = {
        ...record,
        rationale: explainPayment(record, {
          service,
          settlement,
          riskReasons: riskCheck.reasons,
        }),
      };
      this.ledger.upsert(record);
      return {
        payment: record,
        settlement,
        adapterMeta: this.facade.dualStatus(),
      };
    }

    // quote
    const quoteRes = await this.facade.x402.quote(intent);
    const quote = quoteRes.data;
    record = {
      ...record,
      quoteId: quote.quoteId,
      status: "QUOTED",
      stage: "quote",
      updatedAt: new Date().toISOString(),
      mockLabel: quote.label,
    };
    this.ledger.upsert(record);

    // confirm gate
    const confirmed = risk.requireConfirm ? Boolean(req.confirm) : true;
    if (risk.requireConfirm && !confirmed) {
      record = {
        ...record,
        status: "AWAITING_CONFIRM",
        stage: "confirm",
        updatedAt: new Date().toISOString(),
        mockLabel: "AWAITING_CONFIRM — set confirm=true to settle",
      };
      record = {
        ...record,
        rationale: explainPayment(record, { service }),
      };
      this.ledger.upsert(record);
      return {
        payment: record,
        quote,
        adapterMeta: this.facade.dualStatus(),
      };
    }

    record = {
      ...record,
      status: "AWAITING_CONFIRM",
      stage: "confirm",
      updatedAt: new Date().toISOString(),
    };
    this.ledger.upsert(record);

    // settle via x402 adapter
    const settleRes = await this.facade.x402.settle(intent, quote, {
      confirmed: true,
      requireConfirm: risk.requireConfirm,
    });

    const now = new Date().toISOString();
    if (
      settleRes.data.status === "CONFIRMED_PAPER" ||
      settleRes.data.status === "SUBMITTED_MOCK"
    ) {
      this.mutateBalances(req.fromAgentId, req.toAgentId, req.amount, req.asset);
      record = {
        ...record,
        status: settleRes.data.status,
        stage: "settle",
        updatedAt: now,
        settledAt: settleRes.data.settledAt ?? now,
        usedMock: settleRes.usedMock,
        mockLabel: settleRes.label,
      };
    } else {
      record = {
        ...record,
        status: settleRes.data.status,
        stage: "settle",
        updatedAt: now,
        rejectReason:
          settleRes.data.status === "REJECTED" || settleRes.data.status === "FAILED"
            ? settleRes.data.note
            : record.rejectReason,
        usedMock: settleRes.usedMock,
        mockLabel: settleRes.label,
      };
    }
    this.ledger.upsert(record);

    const buyer = getAgent(req.fromAgentId, this.agents);
    const seller = getAgent(req.toAgentId, this.agents);
    const dailyAfter = this.ledger.dailySpendUsd(req.fromAgentId);
    const settlement = (
      await this.facade.mcp.getSettlementContext({
        buyerUsdt: buyer?.paperBalanceUsdt ?? 0,
        sellerUsdt: seller?.paperBalanceUsdt ?? 0,
        buyerUsdc: buyer?.paperBalanceUsdc ?? 0,
        sellerUsdc: seller?.paperBalanceUsdc ?? 0,
        dailySpendUsedUsd: dailyAfter,
        dailyCapUsd: Math.min(risk.dailySpendCapUsd, risk.x402DocumentedDailyCapUsd),
      })
    ).data;

    record = {
      ...record,
      rationale: explainPayment(record, { service, settlement }),
    };
    this.ledger.upsert(record);

    return {
      payment: record,
      quote,
      settlement,
      adapterMeta: this.facade.dualStatus(),
    };
  }

  async payForService(
    buyerId: string,
    serviceId: string,
    opts?: { confirm?: boolean; amountOverride?: number }
  ): Promise<WorkflowResult> {
    const svc = this.services.find((s) => s.id === serviceId);
    if (!svc) {
      throw new Error(`unknown service: ${serviceId}`);
    }
    return this.runPayment({
      fromAgentId: buyerId,
      toAgentId: svc.sellerAgentId,
      amount: opts?.amountOverride ?? svc.priceUsd,
      asset: svc.asset,
      memo: svc.memoHint,
      serviceId: svc.id,
      confirm: opts?.confirm ?? true,
    });
  }

  snapshot(): DemoRunResult {
    const risk = loadRiskConfig();
    const buyer = this.agents.find((a) => a.role === "buyer") ?? this.agents[0];
    const seller = this.agents.find((a) => a.role === "seller") ?? this.agents[1];
    const dailyUsed = this.ledger.dailySpendUsd(buyer?.id);
    const payments = this.ledger.all();
    return {
      mode: this.facade.mode,
      agents: this.agents,
      payments,
      pending: this.ledger.pending(),
      ledger: payments,
      adapterMeta: this.facade.dualStatus(),
      settlement: {
        buyerBalanceUsdt: buyer?.paperBalanceUsdt ?? 0,
        sellerBalanceUsdt: seller?.paperBalanceUsdt ?? 0,
        buyerBalanceUsdc: buyer?.paperBalanceUsdc ?? 0,
        sellerBalanceUsdc: seller?.paperBalanceUsdc ?? 0,
        dailySpendUsedUsd: dailyUsed,
        dailySpendLeftUsd: Math.max(
          0,
          Math.min(risk.dailySpendCapUsd, risk.x402DocumentedDailyCapUsd) - dailyUsed
        ),
        source: "snapshot",
        usedMock: false,
      },
      successCount: this.ledger.successCount(),
      rejectedCount: this.ledger.rejectedCount(),
      attemptCount: this.ledger.attemptCount(),
      rationales: payments.map((p) => p.rationale).filter(Boolean) as NonNullable<
        PaymentRecord["rationale"]
      >[],
    };
  }
}

/**
 * Demo scenario: ≥2 A2A payment attempts + ≥1 risk reject (over cap).
 * Uses env mode (default live) — does not force paper.
 */
export async function runDemoScenario(): Promise<DemoRunResult> {
  const engine = new PayPulseEngine({
    facade: new AgentOsFacade(),
  });

  // 1) market brief — live: PENDING/REJECTED; paper: CONFIRMED_PAPER
  await engine.payForService("agent-buyer-alpha", "svc-market-brief", { confirm: true });

  // 2) signal pack — second attempt
  await engine.payForService("agent-buyer-alpha", "svc-signal-pack", { confirm: true });

  // 3) oversize — rejected (over max payment + documented x402 / daily cap)
  await engine.payForService("agent-buyer-alpha", "svc-oversize-audit", { confirm: true });

  return engine.snapshot();
}

export function summarizePayment(p: PaymentRecord): string {
  const base = `${p.status.padEnd(16)} ${p.fromAgentId} → ${p.toAgentId}  ${p.amount} ${p.asset}`;
  if (p.rationale?.headline) return `${base}  | ${p.rationale.headline}`;
  if (p.rejectReason) return `${base}  | ${p.rejectReason}`;
  if (p.mockLabel) return `${base}  | ${p.mockLabel}`;
  return base;
}
