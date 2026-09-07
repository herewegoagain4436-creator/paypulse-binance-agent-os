# PayPulse - Demo guide

## Quick start

    cd paypulse-binance-agent-os
    npm install
    npm run demo

Expected (live default):
1. Dual-rail status printed (x402 + MCP) with mode=live
2. At least **2** A2A payment attempts with honest live statuses (PENDING / AWAITING_CONFIRM / auth REJECTED) - **not** silent CONFIRMED_PAPER
3. At least **1** risk-rejected payment (over max size / documented x402 daily cap)
4. Explainable why-pay / why-reject rationales
5. Exit 0 with DEMO PASS

Paper/mock opt-in: PAYPULSE_MODE=paper npm run demo (then paper fills are allowed and labeled).

## Dashboard

    npm run dev

Open the Vite URL (default port 5174), click **Run A2A demo**. Cards show live adapter statuses, agents, pending payments, ledger, and rationales.

## What the demo shows

1. Buyer agent-buyer-alpha pays Brief Seller for a market brief (USD5 USDT)
2. Same buyer pays Signal Pack Seller for an intraday signal pack (USD8 USDC)
3. Oversize deep audit (USD25) is **REJECTED** - exceeds local max payment and documented x402 USD20/day default
4. MCP settlement context (seed / host OAuth-aware labels)
5. Risk gates: max payment, daily spend, kill-switch, require confirm
6. Rationales: why pay vs why reject (rules templates, no LLM)

## Agent OS (both rails)

### x402 (Payments)
- https://www.binance.com/binancex402
- Programmable A2A payments: intent -> quote -> confirm -> settle
- Documented default daily cap: USD20/day - not a guarantee; confirm in Binance App / wallet settings
- Live: PENDING / REJECTED honestly - never fake paper fills

### MCP (Account / context)
- Endpoint: https://agent.binance.com/mcp/agentic
- Auth: OAuth client flow via an **MCP host** (Grok is one optional example; other hosts may use a different oauth_client_id). No device API keys.
- Do not open the MCP URL in a browser.
- Used here for balances / settlement context. No withdrawal scope.

Details: AGENT_OS_NOTES.md - Judge script: JUDGE.md

## Disclaimer

Not financial advice. Live path does not invent fills. Paper/mock only when opted in. No secrets. No withdrawals.
