import type { DualAdapterMeta } from "../../core/types";

export function AdapterStatus({ meta }: { meta: DualAdapterMeta }) {
  return (
    <div className="grid" style={{ marginBottom: 0 }}>
      <div className="card half" style={{ margin: 0 }}>
        <h2>x402 rail (Payments)</h2>
        <p className="mono">{meta.x402.endpoint}</p>
        <p className="sub">
          documented daily cap: ${meta.x402.documentedDailyCapUsd}/day (default, not a
          guarantee)
        </p>
        <p className="sub">
          usedMock={String(meta.x402.usedMock)} · {meta.x402.label}
        </p>
      </div>
      <div className="card half" style={{ margin: 0 }}>
        <h2>MCP rail (Account / context)</h2>
        <p className="mono">{meta.mcp.endpoint}</p>
        <p className="sub">oauth_client_id={meta.mcp.oauthClientId}</p>
        <p className="sub">
          usedMock={String(meta.mcp.usedMock)} · {meta.mcp.label}
        </p>
      </div>
    </div>
  );
}
