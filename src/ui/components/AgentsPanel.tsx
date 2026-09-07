import type { AgentProfile } from "../../core/types";

export function AgentsPanel({ agents }: { agents: AgentProfile[] }) {
  return (
    <div className="card">
      <h2>Agents</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>USDT</th>
            <th>USDC</th>
            <th>payTo</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id}>
              <td className="mono">{a.id}</td>
              <td>
                {a.name}
                <div className="sub" style={{ marginTop: 2 }}>
                  {a.description}
                </div>
              </td>
              <td>
                <span className="pill">{a.role}</span>
              </td>
              <td className="mono">{a.paperBalanceUsdt}</td>
              <td className="mono">{a.paperBalanceUsdc}</td>
              <td className="mono">{a.payTo?.address ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
