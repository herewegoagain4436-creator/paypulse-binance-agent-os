# PayPulse — A2A x402 payments

## Aim

Build an **agent-to-agent payment product**: a buyer agent pays a seller agent for a resource through Binance **x402**.

## Protocol

**HTTP 402 → preview → confirm → sign → replay → deliver**

- Paper: local HMAC facilitator, resource unlocked.
- Live: Agentic Wallet `baw x402-payment preview/sign`; unpaid 402 until B402 merchant verify/settle.
- MCP: balances / market-data context only.

## Defaults

- `PAYPULSE_MODE=live`
- Risk: max payment, daily cap (reserved PENDING counts), live `x402QuotaLeft` when `baw` is signed in, kill-switch, require confirm
- Ledger: PENDING / QUOTED / AWAITING_CONFIRM / DELIVERED / SETTLED / REJECTED / …
- Explainable why-pay / why-reject (no LLM required)
- Dashboard: quote, pay, confirm/reject pending, quota, txHash, delivery

See README.md, DEMO.md, JUDGE.md, AGENT_OS_NOTES.md.
