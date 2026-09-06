import type { PaymentRecord } from "../../core/types";

export function PendingPanel({ pending }: { pending: PaymentRecord[] }) {
  return (
    <div className="card half">
      <h2>Pending payments</h2>
      {pending.length === 0 ? (
        <p className="sub">No pending intents / quotes / confirms.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>From → To</th>
              <th>Amount</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.id}>
                <td className={`status-${p.status}`}>{p.status}</td>
                <td className="mono">
                  {p.fromAgentId} → {p.toAgentId}
                </td>
                <td className="mono">
                  {p.amount} {p.asset}
                </td>
                <td className="mono">{p.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
