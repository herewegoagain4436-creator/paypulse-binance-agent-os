import type { PaymentRecord } from "../../core/types";

export function LedgerPanel({ ledger }: { ledger: PaymentRecord[] }) {
  return (
    <div className="card">
      <h2>A2A payment ledger</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>From → To</th>
            <th>Amount</th>
            <th>Memo</th>
            <th>Label / reason</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((p) => (
            <tr key={p.id}>
              <td className={`status-${p.status}`}>{p.status}</td>
              <td className="mono">
                {p.fromAgentId} → {p.toAgentId}
              </td>
              <td className="mono">
                {p.amount} {p.asset}
              </td>
              <td className="mono">{p.memo}</td>
              <td className="sub">
                {p.rejectReason ?? p.mockLabel ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
