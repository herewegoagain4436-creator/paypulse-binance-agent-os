import type { DemoRunResult } from "../core/types";
import { AdapterStatus } from "./components/AdapterStatus";
import { AgentsPanel } from "./components/AgentsPanel";
import { LedgerPanel } from "./components/LedgerPanel";
import { PendingPanel } from "./components/PendingPanel";
import { ServicesPanel } from "./components/ServicesPanel";

export function AppBody({
  result,
  loading,
  onPay,
  onConfirm,
  onReject,
}: {
  result: DemoRunResult;
  loading: boolean;
  onPay: (serviceId: string, confirm: boolean) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const q = result.settlement.quota;
  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: "span 12" }}>
        <AdapterStatus meta={result.adapterMeta} />
      </div>

      <div className="card half">
        <h2>Live / documented quota</h2>
        <p className="mono">
          {q.source}: used ${q.used} · left ${q.left} · limit ${q.dailyLimit}
        </p>
        <p className="sub">{q.label}</p>
        <p className="sub" style={{ marginTop: 8 }}>
          local reserved ${result.settlement.dailySpendReservedUsd} · filled+reserved $
          {result.settlement.dailySpendUsedUsd} · left ${result.settlement.dailySpendLeftUsd}
        </p>
        <p className="sub">
          attempts={result.attemptCount} · fills={result.successCount} · delivered=
          {result.deliveredCount} · rejected={result.rejectedCount}
        </p>
      </div>

      <div className="card half">
        <h2>Settlement context</h2>
        <p className="sub">
          buyer USDT={result.settlement.buyerBalanceUsdt} USDC=
          {result.settlement.buyerBalanceUsdc}
        </p>
        <p className="sub">
          seller USDT={result.settlement.sellerBalanceUsdt} USDC=
          {result.settlement.sellerBalanceUsdc}
        </p>
        <p className="sub">
          source={result.settlement.source} · usedMock={String(result.settlement.usedMock)}
        </p>
        <p className="sub">MCP is not the payment rail. x402 is.</p>
      </div>

      <AgentsPanel agents={result.agents} />

      <ServicesPanel
        services={result.services}
        loading={loading}
        onPay={(id) => onPay(id, false)}
        onPayAndSign={(id) => onPay(id, true)}
      />

      <PendingPanel
        pending={result.pending}
        loading={loading}
        onConfirm={onConfirm}
        onReject={onReject}
      />

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
