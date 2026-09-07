# PayPulse — Track A (Binance Agent OS Mini Hackathon 2026)

## Aim: Payment Workflows

Build an **Agent-to-Agent (A2A) payment workflow** product on Binance Agent OS, centered on **Binance x402** programmable payments, with **MCP** for account / settlement context.

## Product
**PayPulse** — buyer agent pays seller agent for a service (market brief, signal pack) through an x402-style pipeline:

**intent → quote → confirm → settle** (live default; honest PENDING / AWAITING_CONFIRM / REJECTED).

## Dual-rail awareness
- **Payments / x402:** https://www.binance.com/binancex402 — documented **USD20/day** default cap (labeled as documented default, **not a guarantee**)
- **MCP (account/context):** https://agent.binance.com/mcp/agentic — OAuth via an MCP host (oauth_client_id configurable; **Grok is one optional example**)

## Defaults
- **Live** mode (PAYPULSE_MODE=live); paper/mock are explicit opt-in
- Risk: max payment size, daily spend cap, kill-switch, require confirm
- Ledger statuses: PENDING / QUOTED / AWAITING_CONFIRM / CONFIRMED_PAPER (paper only) / SUBMITTED_MOCK (mock only) / REJECTED / FAILED
- Explainable why-pay / why-reject rationales (no LLM required)
- Mocks explicitly labeled; no secrets; no withdrawals; no fake live settles

See README.md, DEMO.md, JUDGE.md, AGENT_OS_NOTES.md.
