/**
 * Dual-rail facade for PayPulse:
 *  - x402 programmable payments (intent → quote → confirm → settle)
 *  - MCP agentic for account / settlement context
 */
import type { DualAdapterMeta } from "../core/types.js";
import { envStr } from "../core/env.js";
import { X402PaymentsAdapter, type AdapterMode as XMode } from "./x402Payments.js";
import { McpAgenticAdapter, type AdapterMode as MMode } from "./mcpAgentic.js";

export type FacadeMode = XMode & MMode;

function modeFromEnv(): FacadeMode {
  const m = envStr("PAYPULSE_MODE", "paper").toLowerCase();
  if (m === "live" || m === "mock" || m === "paper") return m;
  return "paper";
}

export class AgentOsFacade {
  readonly mode: FacadeMode;
  readonly x402: X402PaymentsAdapter;
  readonly mcp: McpAgenticAdapter;

  constructor(opts?: { mode?: FacadeMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.x402 = new X402PaymentsAdapter({ mode: this.mode });
    this.mcp = new McpAgenticAdapter({ mode: this.mode });
  }

  dualStatus(): DualAdapterMeta {
    const x = this.x402.status();
    const m = this.mcp.status();
    return {
      mode: this.mode,
      x402: {
        endpoint: x.endpoint,
        usedMock: x.usedMock,
        label: x.label,
        documentedDailyCapUsd: x.documentedDailyCapUsd,
      },
      mcp: {
        endpoint: m.endpoint,
        oauthClientId: m.oauthClientId,
        usedMock: m.usedMock,
        label: m.label,
      },
    };
  }
}
