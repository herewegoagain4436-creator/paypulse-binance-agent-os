import { describe, expect, it } from "vitest";
import { AgentOsFacade } from "../src/adapters/agentOsFacade.ts";
import { PayPulseEngine } from "../src/core/workflow.ts";

describe("live honesty", () => {
  it("does not deliver or paper-fill without a B402 merchant", async () => {
    const engine = new PayPulseEngine({
      facade: new AgentOsFacade({ mode: "live" }),
      persist: false,
    });
    const r = await engine.payForService("agent-buyer-alpha", "svc-market-brief", {
      confirm: true,
    });
    expect(["PENDING", "AWAITING_CONFIRM", "QUOTED", "REJECTED"]).toContain(r.payment.status);
    expect(r.payment.status).not.toBe("DELIVERED");
    expect(r.payment.status).not.toBe("CONFIRMED_PAPER");
    expect(r.payment.delivery).toBeUndefined();
  });
});
