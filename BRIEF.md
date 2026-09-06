# PayPulse — Track A (Binance Agent OS Mini Hackathon 2026)

## Aim: Payment Workflows

Build an **Agent-to-Agent (A2A) payment workflow** product on Binance Agent OS, centered on **Binance x402** programmable payments, with **MCP** for account / settlement context.

## Product
**PayPulse** — buyer agent pays seller agent for a service (market brief, signal pack) through an x402-style pipeline:

**intent → quote → confirm → settle** (paper/sim default).

## Dual-rail awareness
- **Payments / x402:** https://www.binance.com/binancex402 — documented **$20/day** default cap (labeled as documented default, **not a guarantee**)
- **MCP (account/context):** https://agent.binance.com/mcp/agentic (`oauth_client_id=grok`)

## Defaults
- Paper/sim mode
- Risk: max payment size, daily spend cap, kill-switch, require confirm
- Ledger statuses: PENDING / CONFIRMED_PAPER / FAILED (plus quote/confirm intermediates)
- Mocks explicitly labeled; no secrets; no withdrawals

See README.md, DEMO.md, AGENT_OS_NOTES.md.
