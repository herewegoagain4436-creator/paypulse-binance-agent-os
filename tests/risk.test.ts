import { describe, expect, it } from "vitest";
import { checkPaymentRisk, loadRiskConfig } from "../src/core/risk.ts";
import type { PaymentIntent } from "../src/core/types.ts";

function intent(over: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    id: "i1",
    fromAgentId: "agent-buyer-alpha",
    toAgentId: "agent-seller-brief",
    amount: 5,
    asset: "USDT",
    memo: "t",
    resourceUrl: "/svc/market-brief",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("risk gates", () => {
  it("rejects oversize vs max payment", () => {
    const r = checkPaymentRisk(intent({ amount: 25 }), 0, loadRiskConfig());
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/max payment/);
  });

  it("counts reserved daily spend toward the local cap", () => {
    const r = checkPaymentRisk(intent({ amount: 8 }), 15, {
      ...loadRiskConfig(),
      dailySpendCapUsd: 20,
      maxPaymentUsd: 15,
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/reserved PENDING/);
  });

  it("uses live x402QuotaLeft when provided", () => {
    const r = checkPaymentRisk(intent({ amount: 8 }), 0, loadRiskConfig(), {
      source: "baw-wallet-settings",
      dailyLimit: 20,
      used: 18,
      left: 2,
      asOf: new Date().toISOString(),
      label: "live",
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/x402QuotaLeft/);
  });

  it("rejects same-agent payments", () => {
    const r = checkPaymentRisk(
      intent({ fromAgentId: "x", toAgentId: "x" }),
      0,
      loadRiskConfig()
    );
    expect(r.ok).toBe(false);
  });
});
