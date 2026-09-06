# Binance Agent OS — Notes for PayPulse

PayPulse is a **Payment Workflows** product. It wires **both** Agent OS surfaces relevant to A2A payments.

## 1) Binance x402 — programmable payments

| Key | Value |
|-----|-------|
| Product | https://www.binance.com/binancex402 |
| Role | Agent-to-agent programmable payments (intent / quote / settle style flows) |
| Documented default daily cap | **$20 / day** |

### Cap labeling (important)

The **$20/day** figure is a **documented default** from public Agent OS / Agentic Wallet materials (e.g. `x402DailyLimit`). It is **not** an invented guarantee or SLA. Live quotas can differ — **confirm in the Binance App / wallet settings**.

Adapter: `src/adapters/x402Payments.ts`
Paper/mock interface: create intent, quote, settle within risk + documented cap checks, kill-switch.

## 2) MCP — account / settlement context

| Key | Value |
|-----|-------|
| URL | `https://agent.binance.com/mcp/agentic` |
| Auth | **Client OAuth flow** — no API keys stored on device |
| OAuth client id (Grok) | `grok` |

### Grok CLI setup (reference)

```text
add binance-mcp-server with url=https://agent.binance.com/mcp/agentic oauth_client_id=grok
```

Do **not** open the MCP endpoint in a browser. Use the MCP client / OAuth flow only.

### Capabilities used by PayPulse

- **Account context:** agentic sub-account style balances for settlement awareness
- **No withdrawal scope**
- Confirmations still apply for live actions
- Sub-account **starts empty** when used live — fund from the Binance UI

Adapter: `src/adapters/mcpAgentic.ts`

## Dual-rail facade

`src/adapters/agentOsFacade.ts` exposes **both**:

- **x402** for A2A payment intent → quote → confirm → settle
- **MCP** for settlement / balance context shown in CLI + dashboard

## PayPulse usage

- Default mode: **paper/sim** (`PAYPULSE_MODE=paper`). Local ledger fills. Not live Binance money movement.
- When live x402 / MCP is unavailable, adapters return **explicitly labeled MOCK** responses.
- This project does **not** invent Binance guarantees. Paper ≠ live. Mock ≠ live. Documented caps ≠ contractual SLAs.
- Risk layer (`src/core/risk.ts`): max payment size, daily spend cap, documented x402 cap check, require confirm, kill-switch.

## Official docs / references

- x402 product: https://www.binance.com/binancex402
- Agentic MCP server: https://developers.binance.com/en/docs/agent-native/mcp-server/agentic
- Agent Native overview: https://developers.binance.com/en/docs/agent-native/overview
- LLms index: https://developers.binance.com/en/docs/llms.txt
- Wallet settings (x402DailyLimit reference): Binance Skills Hub agentic-wallet wallet-setting docs

## Safety

- Never put Binance API secret keys in `.env` for Agent OS — MCP auth is OAuth.
- Prefer paper mode for demos and hackathon judging.
- No withdrawals in this product.
- Kill-switch and risk limits apply before x402 settle.
