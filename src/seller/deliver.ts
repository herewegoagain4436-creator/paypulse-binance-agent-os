import type { ServiceOffer } from "../core/types.js";

export function renderDelivery(service: ServiceOffer, paid: { amount: number; asset: string }): {
  mimeType: string;
  body: string;
} {
  const now = new Date().toISOString();
  if (service.id === "svc-market-brief") {
    return {
      mimeType: "text/markdown",
      body: [
        `# ${service.title}`,
        ``,
        `Paid ${paid.amount} ${paid.asset} via x402 at ${now}.`,
        ``,
        `## Overnight movers (educational)`,
        `- BTC: range-bound; watch prior day high/low.`,
        `- ETH: follows BTC beta; funding not a signal by itself.`,
        ``,
        `Not financial advice. Delivered only after a verified payment.`,
      ].join("\n"),
    };
  }
  if (service.id === "svc-signal-pack") {
    return {
      mimeType: "application/json",
      body: JSON.stringify(
        {
          title: service.title,
          paid: `${paid.amount} ${paid.asset}`,
          deliveredAt: now,
          disclaimer: "Educational only. Not financial advice.",
          signals: [
            { symbol: "SOLUSDT", bias: "neutral", note: "Wait for session range." },
            { symbol: "BNBUSDT", bias: "neutral", note: "Liquidity around round numbers." },
            { symbol: "AVAXUSDT", bias: "neutral", note: "Thin book; size down." },
          ],
        },
        null,
        2
      ),
    };
  }
  return {
    mimeType: "text/plain",
    body: `${service.title}\nPaid ${paid.amount} ${paid.asset} at ${now}\nEducational delivery.`,
  };
}
