# PayPulse — Demo guide

## Paper (full product loop)

```bash
npm install
npm run demo:paper
```

Expected:

1. Dual-rail status (`mode=paper`)
2. Two **DELIVERED** resources (market brief + signal pack) with payload
3. One **REJECTED** oversize ($25 > max $15 and documented $20 cap)
4. Why-pay / why-reject rationales
5. `DEMO PASS`

## Live (honest unpaid 402)

```bash
npm run demo
```

Expected: ≥2 attempts with **PENDING** (no baw / no B402 merchant) + ≥1 risk reject. **No** `CONFIRMED_PAPER` / `DELIVERED`.

Optional live buyer: install `baw`, `baw auth signin`, then re-run. Preview/sign may succeed; delivery still needs B402 merchant settle.

## Dashboard

```bash
npm run dev
```

Open http://127.0.0.1:5174

- **Run A2A demo** — smoke as above
- **Quote** — stop at AWAITING_CONFIRM
- **Pay** — sign immediately
- **Confirm / Reject** on pending rows
- Quota bar: documented default or live `baw wallet settings`
- Ledger shows `payTo`, `txHash`, delivered body

Probe a resource directly:

```bash
curl -i http://127.0.0.1:5174/svc/market-brief
```

You should see `HTTP/1.1 402` and an `accepts[]` array.

## Judge script

See JUDGE.md (60–90s).
