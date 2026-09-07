# PayPulse — Judge demo script (60–90 seconds)

**Product:** A2A payments via Binance **x402** (HTTP 402 → preview → sign → replay). MCP is context only.
**Paper path shows delivery. Live path stays honest PENDING.**

## Prep

```
cd paypulse-binance-agent-os
npm install
```

## 60–90s script

| Time | Say / show |
|------|------------|
| 0:00–0:15 | Identity: A2A x402. Seller returns HTTP 402 with v2 `accepts[]` + `payTo`. Buyer preview → sign → replay. MCP is not settle. $20/day = documented `x402DailyLimit`, not a guarantee. |
| 0:15–0:40 | `npm run demo:paper`. Two **DELIVERED** payloads + one oversize **REJECTED**. Read why-pay / why-reject. |
| 0:40–0:55 | `curl -i http://127.0.0.1:5174/svc/market-brief` (after `npm run dev`) — show **402**. |
| 0:55–1:15 | Dashboard: Quote (AWAITING_CONFIRM) → Confirm. Quota + payTo + delivery. |
| 1:15–1:30 | Close: live never paper-fills. No secrets. No withdrawals. B402 merchant onboard still required for on-chain seller settle. |

## Pass criteria (smoke)

- Paper: ≥2 delivered resources + ≥1 risk reject
- Live: no CONFIRMED_PAPER / DELIVERED
- Rationales visible
- `/svc/market-brief` returns 402 when unpaid

## Commands

```
npm test
npm run demo:paper
npm run demo
npm run dev
```
