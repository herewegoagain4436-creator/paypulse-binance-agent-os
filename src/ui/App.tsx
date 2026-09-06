import { useMemo, useState } from "react";
import { AgentOsFacade } from "../adapters/agentOsFacade";
import { describeAgents } from "../core/agents";
import type { DemoRunResult } from "../core/types";
import { runDemoScenario } from "../core/workflow";
import { AppBody } from "./AppBody";

export function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const agentsLine = useMemo(() => describeAgents(), []);
  const dualPreview = useMemo(() => new AgentOsFacade({ mode: "paper" }).dualStatus(), []);

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
            settlement context. Paper/sim default; mocks labeled. No withdrawals.
          </p>
          <p className="sub mono">Agents: {agentsLine}</p>
        </div>
        <div className="actions">
          <span className="badge">mode: paper</span>
          <span className="badge">x402 + MCP</span>
          <button onClick={runDemo} disabled={loading}>
            {loading ? "Running..." : "Run A2A demo"}
          </button>
        </div>
      </header>

      {!result ? (
        <div className="grid" style={{ marginBottom: 14 }}>
          <div className="card half">
            <h2>x402 rail (Payments)</h2>
            <p className="mono">{dualPreview.x402.endpoint}</p>
            <p className="sub">
              documented daily cap: ${dualPreview.x402.documentedDailyCapUsd}/day
              (default, not a guarantee)
            </p>
            <p className="sub">{dualPreview.x402.label}</p>
          </div>
          <div className="card half">
            <h2>MCP rail (Account / context)</h2>
            <p className="mono">{dualPreview.mcp.endpoint}</p>
            <p className="sub">oauth_client_id={dualPreview.mcp.oauthClientId}</p>
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
          <h2>Ready</h2>
          <p className="sub">
            Click <strong>Run A2A demo</strong> for 2 successful paper payments (market
            brief + signal pack) and 1 rejection over the documented x402 / local daily
            cap.
          </p>
        </div>
      ) : null}

      {result ? <AppBody result={result} /> : null}

      <p className="disclaimer">
        Disclaimer: Not financial advice. Paper and mock settlements are <strong>not</strong>{" "}
        live Binance x402 payments. Documented x402 daily cap ($
        {dualPreview.x402.documentedDailyCapUsd}/day) is a <strong>documented default</strong>
        , not a guarantee — confirm live quotas in the Binance App / wallet settings. MCP
        uses OAuth (<code>oauth_client_id=grok</code>); no API secrets in this app. No
        withdrawal scope.
      </p>
    </div>
  );
}
