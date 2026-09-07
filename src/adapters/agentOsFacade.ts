/**
 * Dual-rail facade:
 *  - x402 programmable payments (HTTP 402 → preview → sign → replay)
 *  - MCP for account/market-data context (not the payment rail)
 */
import type { DualAdapterMeta, QuotaSnapshot, WalletStatus } from "../core/types.js";
import { modeFromEnv, type AdapterMode } from "../core/env.js";
import { X402_DOCUMENTED_DAILY_CAP_USD } from "../core/risk.js";
import { X402PaymentsAdapter } from "./x402Payments.js";
import { McpAgenticAdapter } from "./mcpAgentic.js";
import { probeWallet, readX402Quota } from "./agenticWallet.js";

export class AgentOsFacade {
  readonly mode: AdapterMode;
  readonly x402: X402PaymentsAdapter;
  readonly mcp: McpAgenticAdapter;
  private wallet: WalletStatus = {
    available: false,
    signedIn: false,
    label: "wallet not probed yet",
    command: "baw wallet status --json",
  };
  private quota: QuotaSnapshot = {
    source: "documented-default",
    dailyLimit: X402_DOCUMENTED_DAILY_CAP_USD,
    used: 0,
    left: X402_DOCUMENTED_DAILY_CAP_USD,
    asOf: new Date().toISOString(),
    label: "documented x402DailyLimit default $20/day (not a guarantee)",
  };

  constructor(opts?: { mode?: AdapterMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.x402 = new X402PaymentsAdapter({ mode: this.mode });
    this.mcp = new McpAgenticAdapter({ mode: this.mode });
  }

  async refreshLive(): Promise<void> {
    if (this.mode !== "live") return;
    const [wallet, quota] = await Promise.all([probeWallet(), readX402Quota()]);
    this.wallet = wallet;
    this.quota = quota;
  }

  currentQuota(): QuotaSnapshot {
    return this.quota;
  }

  dualStatus(): DualAdapterMeta {
    const x = this.x402.status();
    const m = this.mcp.status();
    return {
      mode: this.mode,
      x402: {
        mode: this.mode,
        endpoint: x.endpoint,
        productUrl: x.endpoint,
        usedMock: x.usedMock,
        label: x.label,
        documentedDailyCapUsd: x.documentedDailyCapUsd,
        wallet: this.wallet,
        quota: this.quota,
      },
      mcp: {
        mode: this.mode,
        endpoint: m.endpoint,
        oauthClientId: m.oauthClientId,
        usedMock: m.usedMock,
        label: m.label,
      },
    };
  }
}
