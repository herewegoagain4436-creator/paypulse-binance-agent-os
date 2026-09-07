import type { ServiceOffer } from "../../core/types";

export function ServicesPanel({
  services,
  loading,
  onPay,
  onPayAndSign,
}: {
  services: ServiceOffer[];
  loading: boolean;
  onPay: (serviceId: string) => void;
  onPayAndSign: (serviceId: string) => void;
}) {
  return (
    <div className="card">
      <h2>Paid resources (x402)</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Path</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>
                {s.title}
                <div className="sub">{s.description}</div>
              </td>
              <td className="mono">{s.path}</td>
              <td className="mono">
                {s.priceUsd} {s.asset}
              </td>
              <td>
                <div className="actions">
                  <button className="secondary" disabled={loading} onClick={() => onPay(s.id)}>
                    Quote
                  </button>
                  <button disabled={loading} onClick={() => onPayAndSign(s.id)}>
                    Pay
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
