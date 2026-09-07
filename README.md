# PayPulse

Agent-to-agent payments on **Binance x402**.

The payment rail is HTTP **402 Payment Required** → preview → sign → replay → **deliver the resource**. MCP is account / market-data context, not settle.

**Live default.** Paper HMAC delivery is opt-in (`PAYPULSE_MODE=paper`). Live never silently paper-fills.

## Dual-rail Agent OS

| Rail | Role | What PayPulse actually does |
|------|------|-----------------------------|
| **x402** | Pay for an HTTP resource | Seller returns x402 **v2** `accepts[]`. Paper verifies a local HMAC and unlocks the payload. Live uses `baw x402-payment preview/sign` when the Agentic Wallet is signed in. On-chain seller settle still needs B402 merchant `/verify`+`/settle`. |
| **MCP** | Account / market data | Probes `https://agent.binance.com/mcp/agentic`. No in-process OAuth. **Not used to move money.** |

Documented x402 default daily cap: **USD20/day** (`x402DailyLimit`). Live quota is read from `baw wallet settings` when available. Confirm in the Binance App.

## Quick start

```bash
npm install
npm test
npm run demo:paper    # full 402 → HMAC sign → deliver + risk reject
npm run demo          # live: honest PENDING + risk reject (no fake fills)
npm run dev           # dashboard http://127.0.0.1:5174  (API + /svc on the same port)
```

Copy `.env.example` to `.env` if you want to change caps or payTo addresses.

### Live buyer (optional)

1. Install Agentic Wallet CLI: `npm i -g @binance/agentic-wallet`
2. `baw auth signin` then `baw wallet status --json`
3. `PAYPULSE_MODE=live npm run demo` — preview/sign when the wallet is ready; resource stays unpaid until a B402 merchant verifies.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run demo` | Live smoke: ≥2 A2A attempts + ≥1 over-cap reject |
| `npm run demo:paper` | Paper smoke: two **delivered** resources + 1 reject |
| `npm run dev` | Vite UI + `/svc` 402 resources + `/api` + `/mcp` |
| `npm run seller` | Standalone API on :8787 |
| `npm run mcp` | MCP stdio tools for Claude/Cursor |
| `npm test` | Protocol, risk, paper loop |
| `npm run cli` | `once` / `pay` JSON helpers |

## x402 flow

```
Buyer GET /svc/market-brief
  ← 402 + PaymentRequired { x402Version: 2, accepts[] }
preview  (paper HMAC option, or baw x402-payment preview)
confirm
sign     (paper HMAC, or baw x402-payment sign → PAYMENT-SIGNATURE)
replay GET /svc/market-brief + PAYMENT-SIGNATURE
  ← 200 + body + PAYMENT-RESPONSE.txHash   (paper)
  ← 402 unpaid                             (live without B402 merchant)
```

Paid resources (in-process and on the dev server):

- `GET /svc/market-brief` — $5 USDT
- `GET /svc/signal-pack` — $8 USDC
- `GET /svc/oversize-audit` — $25 (risk-rejected)

Sellers have `payTo` addresses (BSC). Override with `PAYPULSE_PAYTO_*`.

## MCP tools

`POST /mcp` (dev server) or `npm run mcp` (stdio):

- `paypulse_list_services`
- `paypulse_preview_payment`
- `paypulse_confirm_payment`
- `paypulse_ledger`

## Safety

- No Binance API secrets in `.env`. MCP auth is OAuth in the host. Wallet sign is `baw`.
- No withdrawals.
- Kill-switch and size/daily/live-quota gates run **before** sign.
- Live mode refuses paper HMAC.

See **AGENT_OS_NOTES.md**, **JUDGE.md**, **DEMO.md**.

## Disclaimer

Not financial advice. Paper delivery is local. Live on-chain settle needs a signed-in Agentic Wallet **and** a B402-onboarded merchant to `/verify`+`/settle`. The $20/day figure is a documented default, not an SLA.
