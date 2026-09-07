/**
 * A2A payment workflow: HTTP 402 → preview → confirm → sign → replay.
 * Live settle returns PENDING / AWAITING_CONFIRM / REJECTED — never silent CONFIRMED_PAPER.
 */
import { AgentOsFacade } from "../adapters/agentOsFacade.js";
import { loadAgents, loadServices, getAgent } from "./agents.js";
import { PaymentLedger } from "./ledger.js";
import { explainPayment } from "./reasoning.js";
import { checkPaymentRisk, loadRiskConfig } from "./risk.js";
import { envBool } from "./env.js";
import { resourceUrlFor, serviceById } from "../seller/resources.js";
import type {
  AgentProfile,
  DemoRunResult,
  PaymentIntent,
  PaymentQuote,
  PaymentRecord,
  ServiceOffer,
  WorkflowResult,
} from "./types.js";

export interface CreatePaymentRequest {
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  asset: "USDT" | "USDC" | "U" | "USD1";
  memo: string;
  serviceId?: string;
  confirm?: boolean;
}

export class PayPulseEngine {
  readonly facade: AgentOsFacade;
  readonly ledger: PaymentLedger;
  agents: AgentProfile[];
  services: ServiceOffer[];
  private previewIds = new Map<string, string>();

  constructor(opts?: {
    facade?: AgentOsFacade;
    agents?: AgentProfile[];
    persist?: boolean;
  }) {
    this.facade = opts?.facade ?? new AgentOsFacade();
    this.ledger = new PaymentLedger({ persist: opts?.persist ?? envBool("PAYPULSE_PERSIST", true) });
    this.agents = opts?.agents ?? loadAgents();
    this.services = loadServices();
  }

  private serviceFor(serviceId?: string): ServiceOffer | undefined {
    if (!serviceId) return undefined;
    return this.services.find((s) => s.id === serviceId);
  }

  private mutateBalances(fromId: string, toId: string, amount: number, asset: string) {
    const buyer = getAgent(fromId, this.agents);
    const seller = getAgent(toId, this.agents);
    if (!buyer || !seller) return;
    if (asset === "USDT") {
      buyer.paperBalanceUsdt = Math.round((buyer.paperBalanceUsdt - amount) * 1e6) / 1e6;
      seller.paperBalanceUsdt = Math.round((seller.paperBalanceUsdt + amount) * 1e6) / 1e6;
    } else if (asset === "USDC") {
      buyer.paperBalanceUsdc = Math.round((buyer.paperBalanceUsdc - amount) * 1e6) / 1e6;
      seller.paperBalanceUsdc = Math.round((seller.paperBalanceUsdc + amount) * 1e6) / 1e6;
    }
  }

  private async settlementFor(fromId: string, toId: string) {
    const risk = loadRiskConfig();
    const buyer = getAgent(fromId, this.agents);
    const seller = getAgent(toId, this.agents);
    const filled = this.ledger.dailyFilledUsd(fromId);
    const reserved = this.ledger.dailyReservedUsd(fromId);
    const quota = this.facade.currentQuota();
    const cap = Math.min(risk.dailySpendCapUsd, quota.dailyLimit);
    const mcp = await this.facade.mcp.getSettlementContext({
      buyerUsdt: buyer?.paperBalanceUsdt ?? 0,
      sellerUsdt: seller?.paperBalanceUsdt ?? 0,
      buyerUsdc: buyer?.paperBalanceUsdc ?? 0,
      sellerUsdc: seller?.paperBalanceUsdc ?? 0,
      dailySpendUsedUsd: filled + reserved,
      dailySpendReservedUsd: reserved,
      dailyCapUsd: cap,
      quotaSource: quota.source,
    });
    return { ...mcp.data, quota };
  }

  private async attachRationale(
    record: PaymentRecord,
    extra?: { riskReasons?: string[] }
  ): Promise<PaymentRecord> {
    const service = this.serviceFor(
      this.services.find((s) => s.sellerAgentId === record.toAgentId && s.memoHint === record.memo)
        ?.id
    );
    const settlement = await this.settlementFor(record.fromAgentId, record.toAgentId);
    const next = {
      ...record,
      rationale: explainPayment(record, {
        service,
        settlement,
        riskReasons: extra?.riskReasons,
      }),
    };
    this.ledger.upsert(next);
    return next;
  }

  async runPayment(req: CreatePaymentRequest): Promise<WorkflowResult> {
    await this.facade.refreshLive();
    const risk = loadRiskConfig();
    const quota = this.facade.currentQuota();
    const service = this.serviceFor(req.serviceId);
    const resourceUrl = service ? resourceUrlFor(service) : req.memo;

    const intentRes = this.facade.x402.createIntent({
      fromAgentId: req.fromAgentId,
      toAgentId: req.toAgentId,
      amount: req.amount,
      asset: req.asset,
      memo: req.memo,
      serviceId: req.serviceId,
      resourceUrl,
    });
    const intent = intentRes.data;

    let record = this.facade.x402.buildPendingRecord(intent, risk.requireConfirm);
    this.ledger.upsert(record);

    const dailyUsed = this.ledger.dailySpendUsd(req.fromAgentId) - req.amount;
    const riskCheck = checkPaymentRisk(intent, Math.max(0, dailyUsed), risk, quota);
    if (!riskCheck.ok) {
      record = {
        ...record,
        status: "REJECTED",
        stage: "intent",
        updatedAt: new Date().toISOString(),
        rejectReason: riskCheck.reasons.join("; "),
        mockLabel: "REJECTED by risk / documented x402 cap",
        reservedUsd: 0,
      };
      this.ledger.upsert(record);
      record = await this.attachRationale(record, { riskReasons: riskCheck.reasons });
      return {
        payment: record,
        settlement: await this.settlementFor(req.fromAgentId, req.toAgentId),
        adapterMeta: this.facade.dualStatus(),
      };
    }

    if (!service) {
      record = {
        ...record,
        status: "REJECTED",
        rejectReason: "unknown service — x402 quote needs a resource path",
        updatedAt: new Date().toISOString(),
        reservedUsd: 0,
      };
      this.ledger.upsert(record);
      record = await this.attachRationale(record);
      return {
        payment: record,
        settlement: await this.settlementFor(req.fromAgentId, req.toAgentId),
        adapterMeta: this.facade.dualStatus(),
      };
    }

    const quoteRes = this.facade.x402.quoteForService(intent, service.id);
    const quote = quoteRes.data;
    const preview = await this.facade.x402.preview(quote.paymentRequired as never);
    if (preview.paymentId) this.previewIds.set(record.id, preview.paymentId);

    record = {
      ...record,
      quoteId: quote.quoteId,
      status: "QUOTED",
      stage: "quote",
      updatedAt: new Date().toISOString(),
      mockLabel: quote.label,
      resourceUrl: quote.resourceUrl,
      payTo: quote.payTo,
      network: quote.network,
      tokenAddress: quote.tokenAddress,
      atomicAmount: quote.atomicAmount,
      paymentRequired: quote.paymentRequired,
      previewOptions: preview.options,
      facilitator: preview.facilitator,
    };
    this.ledger.upsert(record);

    const confirmed = risk.requireConfirm ? Boolean(req.confirm) : true;
    if (risk.requireConfirm && !confirmed) {
      record = {
        ...record,
        status: "AWAITING_CONFIRM",
        stage: "confirm",
        updatedAt: new Date().toISOString(),
        mockLabel: "AWAITING_CONFIRM — confirm to sign x402 payment",
      };
      record = await this.attachRationale(record);
      return {
        payment: record,
        quote,
        settlement: await this.settlementFor(req.fromAgentId, req.toAgentId),
        adapterMeta: this.facade.dualStatus(),
      };
    }

    return this.finishSignAndReplay(record, intent, quote);
  }

  async confirmPayment(id: string): Promise<WorkflowResult> {
    const existing = this.ledger.get(id);
    if (!existing) throw new Error(`unknown payment ${id}`);
    if (existing.status !== "AWAITING_CONFIRM" && existing.status !== "QUOTED") {
      throw new Error(`payment ${id} is ${existing.status}, not confirmable`);
    }
    const service = serviceById(
      this.services.find((s) => s.path === existing.resourceUrl || s.memoHint === existing.memo)?.id ??
        ""
    );
    const svc =
      service ??
      this.services.find((s) => s.sellerAgentId === existing.toAgentId && s.priceUsd === existing.amount);
    if (!svc) throw new Error("cannot resume: service missing");
    const intent = {
      id: existing.intentId,
      fromAgentId: existing.fromAgentId,
      toAgentId: existing.toAgentId,
      amount: existing.amount,
      asset: existing.asset,
      memo: existing.memo,
      serviceId: svc.id,
      resourceUrl: existing.resourceUrl ?? svc.path,
      createdAt: existing.createdAt,
    };
    const quoteRes = this.facade.x402.quoteForService(intent, svc.id);
    return this.finishSignAndReplay(existing, intent, quoteRes.data);
  }

  async rejectPayment(id: string, reason = "user rejected confirm"): Promise<WorkflowResult> {
    const existing = this.ledger.get(id);
    if (!existing) throw new Error(`unknown payment ${id}`);
    const record = await this.attachRationale({
      ...existing,
      status: "REJECTED",
      stage: "confirm",
      updatedAt: new Date().toISOString(),
      rejectReason: reason,
      reservedUsd: 0,
    });
    return {
      payment: record,
      settlement: await this.settlementFor(record.fromAgentId, record.toAgentId),
      adapterMeta: this.facade.dualStatus(),
    };
  }

  private async finishSignAndReplay(
    record: PaymentRecord,
    intent: PaymentIntent,
    quote: PaymentQuote
  ): Promise<WorkflowResult> {
    record = {
      ...record,
      status: "AWAITING_CONFIRM",
      stage: "sign",
      updatedAt: new Date().toISOString(),
    };
    this.ledger.upsert(record);

    try {
      const signed = await this.facade.x402.sign({
        intent,
        quote,
        selectedIndex: record.selectedIndex ?? 1,
        paymentId: this.previewIds.get(record.id),
      });
      record = {
        ...record,
        paymentHeaderName: signed.paymentHeaderName,
        paymentHeaderValue: signed.paymentHeaderValue,
        signatureExpiresAt: signed.signatureExpiresAt,
        facilitator: signed.facilitator,
        mockLabel: signed.label,
        txHash: signed.txHash ?? record.txHash,
        stage: "settle",
      };
      this.ledger.upsert(record);

      const path = quote.resourceUrl.startsWith("http")
        ? new URL(quote.resourceUrl).pathname
        : quote.resourceUrl;
      const replay = this.facade.x402.replay(path, signed.paymentHeaderValue);
      const now = new Date().toISOString();
      if (replay.paymentStatus === "DELIVERED" || replay.paymentStatus === "CONFIRMED_PAPER" || replay.paymentStatus === "SUBMITTED_MOCK" || replay.paymentStatus === "SETTLED") {
        this.mutateBalances(intent.fromAgentId, intent.toAgentId, intent.amount, intent.asset);
        record = {
          ...record,
          status: replay.paymentStatus === "CONFIRMED_PAPER" ? "DELIVERED" : replay.paymentStatus,
          stage: "deliver",
          updatedAt: now,
          settledAt: now,
          delivery: replay.delivery,
          txHash: replay.txHash ?? record.txHash,
          mockLabel: replay.note,
          usedMock: this.facade.mode === "mock",
          reservedUsd: 0,
        };
      } else {
        record = {
          ...record,
          status: replay.paymentStatus,
          stage: "settle",
          updatedAt: now,
          rejectReason: replay.paymentStatus === "REJECTED" ? replay.note : record.rejectReason,
          mockLabel: replay.note,
          reservedUsd: replay.paymentStatus === "PENDING" ? intent.amount : 0,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const livePending = this.facade.mode === "live";
      record = {
        ...record,
        status: livePending ? "PENDING" : "REJECTED",
        stage: "sign",
        updatedAt: new Date().toISOString(),
        rejectReason: livePending ? undefined : msg,
        mockLabel: livePending
          ? `LIVE PENDING — ${msg}. Not a paper fill.`
          : msg,
      };
    }

    record = await this.attachRationale(record);
    return {
      payment: record,
      quote,
      settlement: await this.settlementFor(record.fromAgentId, record.toAgentId),
      adapterMeta: this.facade.dualStatus(),
    };
  }

  async payForService(
    buyerId: string,
    serviceId: string,
    opts?: { confirm?: boolean; amountOverride?: number }
  ): Promise<WorkflowResult> {
    const svc = this.services.find((s) => s.id === serviceId);
    if (!svc) throw new Error(`unknown service: ${serviceId}`);
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
    const filled = this.ledger.dailyFilledUsd(buyer?.id);
    const reserved = this.ledger.dailyReservedUsd(buyer?.id);
    const payments = this.ledger.all();
    const quota = this.facade.currentQuota();
    const cap = Math.min(risk.dailySpendCapUsd, quota.dailyLimit);
    return {
      mode: this.facade.mode,
      agents: this.agents,
      services: this.services,
      payments,
      pending: this.ledger.pending(),
      ledger: payments,
      adapterMeta: this.facade.dualStatus(),
      settlement: {
        buyerBalanceUsdt: buyer?.paperBalanceUsdt ?? 0,
        sellerBalanceUsdt: seller?.paperBalanceUsdt ?? 0,
        buyerBalanceUsdc: buyer?.paperBalanceUsdc ?? 0,
        sellerBalanceUsdc: seller?.paperBalanceUsdc ?? 0,
        dailySpendUsedUsd: filled + reserved,
        dailySpendReservedUsd: reserved,
        dailySpendLeftUsd: Math.max(0, cap - filled - reserved),
        source: "snapshot",
        usedMock: this.facade.mode === "mock",
        quota,
      },
      successCount: this.ledger.successCount(),
      rejectedCount: this.ledger.rejectedCount(),
      attemptCount: this.ledger.attemptCount(),
      deliveredCount: this.ledger.deliveredCount(),
      rationales: payments.map((p) => p.rationale).filter(Boolean) as NonNullable<
        PaymentRecord["rationale"]
      >[],
    };
  }
}

export async function runDemoScenario(opts?: {
  confirm?: boolean;
  persist?: boolean;
  facade?: AgentOsFacade;
}): Promise<DemoRunResult> {
  const engine = new PayPulseEngine({
    facade: opts?.facade ?? new AgentOsFacade(),
    persist: opts?.persist ?? false,
  });
  const confirm = opts?.confirm ?? true;
  await engine.payForService("agent-buyer-alpha", "svc-market-brief", { confirm });
  await engine.payForService("agent-buyer-alpha", "svc-signal-pack", { confirm });
  await engine.payForService("agent-buyer-alpha", "svc-oversize-audit", { confirm });
  return engine.snapshot();
}

export function summarizePayment(p: PaymentRecord): string {
  const base = `${p.status.padEnd(16)} ${p.fromAgentId} → ${p.toAgentId}  ${p.amount} ${p.asset}`;
  if (p.txHash) return `${base}  | tx=${p.txHash}`;
  if (p.rationale?.headline) return `${base}  | ${p.rationale.headline}`;
  if (p.rejectReason) return `${base}  | ${p.rejectReason}`;
  if (p.mockLabel) return `${base}  | ${p.mockLabel}`;
  return base;
}
