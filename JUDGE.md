# PayPulse - Judge demo script (60-90 seconds)

**Product:** A2A payments via Binance **x402** + **MCP** (Track A Payment Workflows).
**Default:** PAYPULSE_MODE=live - honest PENDING / AWAITING_CONFIRM / REJECTED. Never silent CONFIRMED_PAPER as live success.

## Prep (once)

    cd paypulse-binance-agent-os
    npm install

## 60-90s script

| Time | Say / show |
|------|------------|
| 0:00-0:15 | Identity: A2A payments; x402 intent->quote->confirm->settle; MCP context; live-first; USD20/day x402 cap = documented default not guarantee. |
| 0:15-0:35 | Run `npm run demo`. Dual-rail status. Show >=2 payment attempts with honest live statuses (PENDING or auth REJECTED). |
| 0:35-0:55 | Highlight >=1 risk reject (oversize USD25). Read why-pay / why-reject rationale. |
| 0:55-1:15 | Optional `npm run dev` - live adapter badges, ledger, rationales. |
| 1:15-1:30 | Close: no secrets, no withdrawals, no fake live settles. |

## Pass criteria (smoke)

- Default mode **live**
- >=2 A2A payment attempts with honest statuses
- >=1 risk reject (over cap or kill switch)
- Live ledger has **no** CONFIRMED_PAPER
- Rationales printed / visible

## Commands

    npm run demo
    npm run dev
    npm run build

See DEMO.md and AGENT_OS_NOTES.md.
