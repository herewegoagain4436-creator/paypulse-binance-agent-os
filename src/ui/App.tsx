import { useMemo, useState } from "react";
import { AgentOsFacade } from "../adapters/agentOsFacade";
import { describeAgents } from "../core/agents";
import { envStr } from "../core/env";
import type { DemoRunResult } from "../core/types";
import { runDemoScenario } from "../core/workflow";
import { AppBody } from "./AppBody";

export function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const agentsLine = useMemo(() => describeAgents(), []);
  const mode = useMemo(() => envStr("VITE_PAYPULSE_MODE", envStr("PAYPULSE_MODE", "live")), []);
  const dualPreview = useMemo(() => new AgentOsFacade().dualStatus(), []);

  async function runDemo() {
    setLoading(true);
    setError(null);
    try {
      const r = await runDemoScenario();
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>
            Pay<span>Pulse</span>
          </h1>
          <p className="sub">
            Track A Payment Workflows: Agent-to-Agent (A2A) payments via Binance{" "}
            <strong>x402</strong> (intent → quote → confirm → settle) with MCP for
            settlement context. <strong>Live default</strong>; honest PENDING /
            AWAITING_CONFIRM / REJECTED — never silent CONFIRMED_PAPER as live success. No
            withdrawals.
          </p>
          <p className="sub mono">Agents: {agentsLine}</p>
        </div>
        <div className="actions">
          <span className={`badge badge-${dualPreview.mode}`}>mode: {dualPreview.mode}</span>
          <span className="badge">x402 + MCP</span>
          <button onClick={runDemo} disabled={loading}>
            {loading ? "Running..." : "Run A2A demo"}
          </button>
        </div>
      </header>

      {!result ? (
        <div className="grid" style={{ marginBottom: 14 }}>
          <div className="card half">
            <h2>x402 rail (Payments) — {dualPreview.x402.mode}</h2>
            <p className="mono">{dualPreview.x402.endpoint}</p>
            <p className="sub">
              documented daily cap: ${dualPreview.x402.documentedDailyCapUsd}/day
              (default, not a guarantee)
            </p>
            <p className="sub">{dualPreview.x402.label}</p>
          </div>
          <div className="card half">
            <h2>MCP rail (Account / context) — {dualPreview.mcp.mode}</h2>
            <p className="mono">{dualPreview.mcp.endpoint}</p>
            <p className="sub">
              oauth_client_id={dualPreview.mcp.oauthClientId} (host-flexible)
            </p>
            <p className="sub">{dualPreview.mcp.label}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="card">
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {!result && !loading ? (
        <div className="card">
          <h2>Ready (mode={mode || dualPreview.mode})</h2>
          <p className="sub">
            Click <strong>Run A2A demo</strong> for ≥2 A2A payment attempts (market brief
            + signal pack) with honest live statuses, plus ≥1 risk rejection over the
            documented x402 / local daily cap. Explainable why-pay / why-reject rationales
            included.
          </p>
        </div>
      ) : null}

      {result ? <AppBody result={result} /> : null}

      <p className="disclaimer">
        Disclaimer: Not financial advice. Live path returns PENDING / AWAITING_CONFIRM /
        REJECTED honestly — paper and mock settles are <strong>only</strong> when{" "}
        <code>PAYPULSE_MODE=paper|mock</code>. Documented x402 daily cap ($
        {dualPreview.x402.documentedDailyCapUsd}/day) is a <strong>documented default</strong>
        , not a guarantee — confirm live quotas in the Binance App / wallet settings. MCP
        uses host OAuth (<code>oauth_client_id</code> configurable; <code>grok</code> is one
        optional example). No API secrets. No withdrawal scope.
      </p>
    </div>
  );
}
