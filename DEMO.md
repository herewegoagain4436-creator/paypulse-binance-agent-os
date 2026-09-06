# PayPulse — Demo guide

## Quick start

```bash
cd /workspace/hackathons/binance-agent-os-payments
npm install
npm run demo
```

Expected:
1. Dual-rail status printed (x402 + MCP)
2. At least 2 successful paper A2A payments (CONFIRMED_PAPER)
3. At least 1 rejected payment (over max size / documented x402 daily cap)
4. Exit 0 with DEMO PASS

## Dashboard

```bash
npm run dev
```

Open the Vite URL (default port 5174), click Run A2A demo. Cards show agents, pending payments, ledger, and both adapter statuses.

## What the demo shows

1. Buyer agent-buyer-alpha pays Brief Seller for a market brief ($5 USDT)
2. Same buyer pays Signal Pack Seller for an intraday signal pack ($8 USDC)
3. Oversize deep audit ($25) is REJECTED — exceeds local max payment and documented x402 $20/day default
4. MCT paper settlement context (balances + daily spend left)
5. Risk gates: max payment, daily spend, kill-switch, require confirm

## Agent OS (both rails)

### x402 (Payments)
- https://www.binance.com/binancex402
- Programmable A2A payments: intent → quote ‒ confirm ‒ settle
- Documented default daily cap: $20/day — not a guarantee; confirm in Binance App / wallet settings

### MCP (Account / context)
- Endpoint: https://agent.binance.com/mcp/agentic
- Auth: OAuth client flow (oauth_client_id=grok). No device API keys.
- Do not open the MCP URL in a browser.
- Used here for balances / settlement context. No withdrawal scope.

Details: AGENT_OS_NOTES.md

## Disclaimer

Not financial advice. Paper/mock is not live Binance x402 settlement. No secrets. No withdrawals.
