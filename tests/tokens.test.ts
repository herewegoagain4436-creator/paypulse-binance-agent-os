import { describe, expect, it } from "vitest";
import { fromAtomic, toAtomic } from "../src/protocol/tokens.ts";
import { buildPaymentRequired } from "../src/protocol/x402.ts";

describe("x402 amounts", () => {
  it("round-trips 5 USDT at 18 decimals", () => {
    const atomic = toAtomic(5, 18);
    expect(atomic).toBe("5000000000000000000");
    expect(fromAtomic(atomic, 18)).toBe(5);
  });

  it("builds a v2 PaymentRequired with payTo and extra", () => {
    const req = buildPaymentRequired({
      resource: {
        url: "/svc/market-brief",
        description: "brief",
        mimeType: "text/markdown",
      },
      amount: 5,
      asset: "USDT",
      payTo: "0x8B3a350e2f3E6B9cC6FB10Fd106bA08f08bec5D2",
    });
    expect(req.x402Version).toBe(2);
    expect(req.accepts[0].payTo).toMatch(/^0x/);
    expect(req.accepts[0].extra.assetTransferMethod).toBe("paypulse-paper-hmac");
    expect(req.accepts[0].extra.signerAddress).toBeTruthy();
    expect(req.accepts[0].extra.spenderAddress).toBeTruthy();
  });
});
