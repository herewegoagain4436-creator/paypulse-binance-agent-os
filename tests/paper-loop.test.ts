import { describe, expect, it } from "vitest";
import { AgentOsFacade } from "../src/adapters/agentOsFacade.ts";
import { PayPulseEngine } from "../src/core/workflow.ts";
import { serveResource } from "../src/seller/resources.ts";
import { paymentRequiredFor, serviceById } from "../src/seller/resources.ts";
import { verifyPaper, signPaper } from "../src/protocol/paperSign.ts";

describe("x402 paper loop", () => {
  it("returns HTTP 402 with v2 accepts when unpaid", () => {
    const res = serveResource("/svc/market-brief", undefined, "paper");
    expect(res.status).toBe(402);
    const body = res.body as { x402Version: number; accepts: unknown[] };
    expect(body.x402Version).toBe(2);
    expect(body.accepts.length).toBeGreaterThan(0);
    expect(res.headers["PAYMENT-REQUIRED"]).toBeTruthy();
  });

  it("delivers the resource after a valid paper HMAC", () => {
    const svc = serviceById("svc-market-brief")!;
    const required = paymentRequiredFor(svc);
    const header = signPaper({
      resourceUrl: required.resource.url,
      amount: svc.priceUsd,
      asset: svc.asset,
      payTo: required.accepts[0].payTo,
      intentId: "intent-test",
      exp: Date.now() + 60_000,
    });
    const verified = verifyPaper(header);
    expect(verified.ok).toBe(true);
    const res = serveResource("/svc/market-brief", header, "paper");
    expect(res.status).toBe(200);
    expect(String(res.body)).toContain("market brief");
  });

  it("refuses paper HMAC in live mode", () => {
    const svc = serviceById("svc-market-brief")!;
    const required = paymentRequiredFor(svc);
    const header = signPaper({
      resourceUrl: required.resource.url,
      amount: svc.priceUsd,
      asset: svc.asset,
      payTo: required.accepts[0].payTo,
      intentId: "intent-live",
      exp: Date.now() + 60_000,
    });
    const res = serveResource("/svc/market-brief", header, "live");
    expect(res.status).toBe(402);
  });

  it("paper engine delivers two services and rejects oversize", async () => {
    const engine = new PayPulseEngine({
      facade: new AgentOsFacade({ mode: "paper" }),
      persist: false,
    });
    const a = await engine.payForService("agent-buyer-alpha", "svc-market-brief", {
      confirm: true,
    });
    const b = await engine.payForService("agent-buyer-alpha", "svc-signal-pack", {
      confirm: true,
    });
    const c = await engine.payForService("agent-buyer-alpha", "svc-oversize-audit", {
      confirm: true,
    });
    expect(a.payment.status).toBe("DELIVERED");
    expect(a.payment.delivery?.body).toContain("BTC");
    expect(b.payment.status).toBe("DELIVERED");
    expect(c.payment.status).toBe("REJECTED");
    expect(c.payment.rejectReason ?? "").toMatch(/exceeds/);
    const snap = engine.snapshot();
    expect(snap.deliveredCount).toBeGreaterThanOrEqual(2);
    expect(snap.rejectedCount).toBeGreaterThanOrEqual(1);
  });

  it("stops at AWAITING_CONFIRM when confirm is withheld", async () => {
    const engine = new PayPulseEngine({
      facade: new AgentOsFacade({ mode: "paper" }),
      persist: false,
    });
    const quoted = await engine.payForService("agent-buyer-alpha", "svc-market-brief", {
      confirm: false,
    });
    expect(quoted.payment.status).toBe("AWAITING_CONFIRM");
    const done = await engine.confirmPayment(quoted.payment.id);
    expect(done.payment.status).toBe("DELIVERED");
  });
});
