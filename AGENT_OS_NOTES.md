# Binance Agent OS — notes for PayPulse

PayPulse is a **payment product**. The money rail is **x402**. MCP is context only.

## 1) x402 — buyer and seller

| Key | Value |
|-----|--------|
| Product | https://www.binance.com/binancex402 |
| Spec | x402 v2 `PaymentRequired` / HTTP 402 |
| Buyer CLI | `baw x402-payment preview` then `baw x402-payment sign` |
| Quota | `baw wallet settings` → `x402DailyLimit` / `x402QuotaLeft` (default $20/day, independent of swap/DeFi caps) |
| Seller settle | B402 `POST /papi/v2/b402/supported` · `/verify` · `/settle` (partner `clientId` + RSA). Buyers never call `/supported`. |

### What PayPulse implements

- Seller resources return a real **x402 v2 402** body (`accepts[]` with `payTo`, `asset`, `extra.signerAddress` / `spenderAddress`).
- **Paper:** HMAC `PAYMENT-SIGNATURE`, in-process verify, **deliver** the brief/signal pack.
- **Live:** `baw` preview/sign when the CLI is installed and signed in. Replay to our seller **does not** call B402 `/settle` unless you onboard as a merchant — status stays **PENDING**. Paper HMAC is refused in live.

### Cap labeling

`$20/day` is the documented `x402DailyLimit` default. Live quota is read from `baw wallet settings` when that command succeeds. Confirm in Binance App → Agentic Wallet settings.

## 2) MCP — not the payment rail

| Key | Value |
|-----|--------|
| URL | `https://agent.binance.com/mcp/agentic` |
| Auth | Client OAuth via an MCP host (`oauth_client_id` configurable; `grok` is one example) |
| Official split | MCP = trading + market data. Payments = x402 / Agentic Wallet. |

PayPulse probes `tools/list` without OAuth and labels seed balances honestly.

## 3) PayPulse MCP (this repo)

So other agents can drive PayPulse:

```
POST /mcp
npm run mcp
```

Tools: list services, preview/confirm payment, ledger.

## Official docs

- x402 product: https://www.binance.com/binancex402
- B402 flow: https://developers.binance.com/en/docs/products/onchainpay-x402/basics/8.typical-integration-flow
- Agentic MCP: https://developers.binance.com/en/docs/agent-native/mcp-server/agentic
- Skills Hub x402-payment: https://github.com/binance/binance-skills-hub/blob/main/skills/binance-web3/binance-agentic-wallet/references/x402-payment.md
- Wallet settings / x402DailyLimit: https://github.com/binance/binance-skills-hub/blob/main/skills/binance-web3/binance-agentic-wallet/references/wallet-setting.md

## Safety

- Never put Binance API secret keys in `.env` for Agent OS.
- No withdrawals.
- Live ≠ paper. Documented cap ≠ live quota unless `baw wallet settings` says so.
