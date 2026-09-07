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
        <span className="badge">x402 HTTP 402 + MCP context</span>
        <span className="badge">
          cap ${meta.x402.quota.dailyLimit}/day ({meta.x402.quota.source})
        </span>
      </div>
      <div className="grid" style={{ marginBottom: 0 }}>
        <div className="card half" style={{ margin: 0 }}>
          <h2>x402 rail (Payments) — {meta.x402.mode}</h2>
          <p className="mono">{meta.x402.productUrl}</p>
          <p className="sub">{meta.x402.label}</p>
          <p className="sub">
            wallet: {meta.x402.wallet.signedIn ? "signed in" : "not signed in"} —{" "}
            {meta.x402.wallet.label}
          </p>
          <p className="sub">{meta.x402.quota.label}</p>
        </div>
        <div className="card half" style={{ margin: 0 }}>
          <h2>MCP rail (Account / market data) — {meta.mcp.mode}</h2>
          <p className="mono">{meta.mcp.endpoint}</p>
          <p className="sub">
            oauth_client_id={meta.mcp.oauthClientId} (host-flexible)
          </p>
          <p className="sub">{meta.mcp.label}</p>
        </div>
      </div>
    </div>
  );
}
