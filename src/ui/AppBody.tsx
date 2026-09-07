import type { DemoRunResult } from "../core/types";
import { AdapterStatus } from "./components/AdapterStatus";
import { AgentsPanel } from "./components/AgentsPanel";
import { LedgerPanel } from "./components/LedgerPanel";
import { PendingPanel } from "./components/PendingPanel";

export function AppBody({ result }: { result: DemoRunResult }) {
  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: "span 12" }}>
        <AdapterStatus meta={result.adapterMeta} />
      </div>

      <AgentsPanel agents={result.agents} />

      <PendingPanel pending={result.pending} />

      <div className="card half">
        <h2>Settlement context</h2>
        <p className="mono">
          daily used ${result.settlement.dailySpendUsedUsd} · left $
          {result.settlement.dailySpendLeftUsd}
        </p>
        <p className="sub">
          buyer USDT={result.settlement.buyerBalanceUsdt} USDC=
          {result.settlement.buyerBalanceUsdc}
        </p>
        <p className="sub">
          seller USDT={result.settlement.sellerBalanceUsdt} USDC=
          {result.settlement.sellerBalanceUsdc}
        </p>
        <p className="sub">
          source={result.settlement.source} · usedMock=
          {String(result.settlement.usedMock)}
        </p>
        <p className="sub" style={{ marginTop: 8 }}>
          attempts={result.attemptCount} · fills={result.successCount} · rejected=
          {result.rejectedCount}
        </p>
      </div>

      {result.rationales.length ? (
        <div className="card">
          <h2>Why pay / why reject</h2>
          <ul className="rationale-list">
            {result.rationales.map((r, i) => (
              <li key={`${r.decision}-${i}`}>
                <span className={`pill decision-${r.decision}`}>{r.decision}</span>{" "}
                <strong>{r.headline}</strong>
                <div className="sub" style={{ marginTop: 4 }}>
                  {r.narrative}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <LedgerPanel ledger={result.ledger} />
    </div>
  );
}
