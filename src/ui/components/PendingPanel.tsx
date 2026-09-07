import type { PaymentRecord } from "../../core/types";

export function PendingPanel({
  pending,
  loading,
  onConfirm,
  onReject,
}: {
  pending: PaymentRecord[];
  loading?: boolean;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
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
              <th></th>
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
                <td>
                  {p.status === "AWAITING_CONFIRM" && onConfirm && onReject ? (
                    <div className="actions">
                      <button disabled={loading} onClick={() => onConfirm(p.id)}>
                        Confirm
                      </button>
                      <button
                        className="secondary"
                        disabled={loading}
                        onClick={() => onReject(p.id)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
