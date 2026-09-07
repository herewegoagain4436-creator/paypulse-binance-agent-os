import type { DualAdapterMeta } from "../../core/types";

function ModeBadge({ mode }: { mode: string }) {
  const m = mode.toLowerCase();
  const cls =
    m === "live" ? "badge badge-live" : m === "paper" ? "badge badge-paper" : "badge badge-mock";
  return <span className={cls}>mode: {mode}</span>;
}

export function AdapterStatus({ meta }: { meta: DualAdapterMeta }) {
  return (
    <div>
      <div className="actions" style={{ marginBottom: 12 }}>
        <ModeBadge mode={meta.mode} />
        <span className="badge">x402 + MCP dual-rail</span>
        <span className="badge">
          x402 cap ${meta.x402.documentedDailyCapUsd}/day (default ≠ guarantee)
        </span>
      </div>
      <div className="grid" style={{ marginBottom: 0 }}>
        <div className="card half" style={{ margin: 0 }}>
          <h2>x402 rail (Payments) — {meta.x402.mode}</h2>
          <p className="mono">{meta.x402.endpoint}</p>
          <p className="sub">
            documented daily cap: ${meta.x402.documentedDailyCapUsd}/day (default, not a
            guarantee)
          </p>
          <p className="sub">
            usedMock={String(meta.x402.usedMock)} · <strong>{meta.x402.label}</strong>
          </p>
        </div>
        <div className="card half" style={{ margin: 0 }}>
          <h2>MCP rail (Account / context) — {meta.mcp.mode}</h2>
          <p className="mono">{meta.mcp.endpoint}</p>
          <p className="sub">
            oauth_client_id={meta.mcp.oauthClientId} (MCP host–flexible; Grok is one
            example)
          </p>
          <p className="sub">
            usedMock={String(meta.mcp.usedMock)} · <strong>{meta.mcp.label}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
