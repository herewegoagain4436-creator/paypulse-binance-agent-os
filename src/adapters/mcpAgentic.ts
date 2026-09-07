/**
 * Binance Agent OS MCP adapter — account / settlement context for PayPulse.
 *
 * Endpoint: https://agent.binance.com/mcp/agentic
 * Auth: client OAuth via an MCP host (Grok is one optional example; other hosts may use
 * a different oauth_client_id). NO API keys on device.
 * Do not open the MCP URL in a browser.
 *
 * Used here for balances / settlement context (read-oriented). No withdrawals.
 * Default: live (PAYPULSE_MODE=live). Paper/mock are explicit opt-in only.
 */
import { envNum, envStr } from "../core/env.js";
import type { SettlementContext } from "../core/types.js";

export const AGENT_OS_MCP_URL = envStr(
  "BINANCE_AGENT_OS_MCP_URL",
  "https://agent.binance.com/mcp/agentic"
);

/** Example default client id for Grok; override for other MCP hosts. */
export const AGENT_OS_OAUTH_CLIENT_ID = envStr(
  "BINANCE_AGENT_OS_OAUTH_CLIENT_ID",
  "grok"
);

export type AdapterMode = "paper" | "mock" | "live";

export interface McpAdapterResult<T> {
  data: T;
  usedMock: boolean;
  label: string;
  endpoint: string;
  oauthClientId: string;
}

function modeFromEnv(): AdapterMode {
  const m = envStr("PAYPULSE_MODE", "live").toLowerCase();
  if (m === "live" || m === "mock" || m === "paper") return m;
  return "live";
}

async function tryMcpToolsList(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return body != null && typeof body === "object";
  } catch {
    return false;
  }
}

export class McpAgenticAdapter {
  readonly mode: AdapterMode;
  readonly endpoint: string;
  readonly oauthClientId: string;
  private lastLabel =
    "LIVE MCP — settlement context requires host OAuth (default mode)";
  private lastUsedMock = false;

  constructor(opts?: { mode?: AdapterMode }) {
    this.mode = opts?.mode ?? modeFromEnv();
    this.endpoint = AGENT_OS_MCP_URL;
    this.oauthClientId = AGENT_OS_OAUTH_CLIENT_ID;
    if (this.mode === "paper") {
      this.lastLabel =
        "PAPER SIM (opt-in) — MCP settlement context from local paper balances (not live)";
    } else if (this.mode === "mock") {
      this.lastLabel = "MOCK (opt-in) — explicit MCP settlement context; not live Binance account";
    }
  }

  status(): McpAdapterResult<null> {
    return {
      data: null,
      usedMock: this.lastUsedMock,
      label: this.lastLabel,
      endpoint: this.endpoint,
      oauthClientId: this.oauthClientId,
    };
  }

  /**
   * Fetch settlement / balance context for A2A payments.
   * Paper: local balances. Mock: labeled mock. Live: probe MCP; never invent live fills.
   */
  async getSettlementContext(input: {
    buyerUsdt: number;
    sellerUsdt: number;
    buyerUsdc: number;
    sellerUsdc: number;
    dailySpendUsedUsd: number;
    dailyCapUsd: number;
  }): Promise<McpAdapterResult<SettlementContext>> {
    const seedCtx = (source: string, usedMock: boolean): SettlementContext => ({
      buyerBalanceUsdt: input.buyerUsdt,
      sellerBalanceUsdt: input.sellerUsdt,
      buyerBalanceUsdc: input.buyerUsdc,
      sellerBalanceUsdc: input.sellerUsdc,
      dailySpendUsedUsd: input.dailySpendUsedUsd,
      dailySpendLeftUsd: Math.max(0, input.dailyCapUsd - input.dailySpendUsedUsd),
      source,
      usedMock,
    });

    if (this.mode === "paper") {
      this.lastUsedMock = false;
      this.lastLabel =
        "PAPER SIM — MCP context from local paper balances (not live)";
      return {
        data: seedCtx("paper-local", false),
        usedMock: false,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    if (this.mode === "mock") {
      this.lastUsedMock = true;
      this.lastLabel = "MOCK — explicit MCP settlement context; not live Binance account";
      return {
        data: seedCtx("mock-labeled", true),
        usedMock: true,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    // LIVE — honest: seed context only until MCP host OAuth is present (not a mock claim)
    const ok = await tryMcpToolsList(this.endpoint);
    this.lastUsedMock = false;
    if (!ok) {
      this.lastLabel =
        `LIVE MCP — OAuth required in MCP host (oauth_client_id=${this.oauthClientId}; Grok is one optional example). Showing local seed context only — not live account balances.`;
      return {
        data: seedCtx("live-seed-awaiting-oauth", false),
        usedMock: false,
        label: this.lastLabel,
        endpoint: this.endpoint,
        oauthClientId: this.oauthClientId,
      };
    }

    this.lastLabel =
      `LIVE MCP reachable — still no in-process OAuth token (client_id=${this.oauthClientId}); seed context only, not live balances`;
    return {
      data: seedCtx("live-mcp-reachable-no-oauth", false),
      usedMock: false,
      label: this.lastLabel,
      endpoint: this.endpoint,
      oauthClientId: this.oauthClientId,
    };
  }

  /** Starting paper balances from env (for UI/CLI). */
  static defaultPaperBalances(): {
    buyerUsdt: number;
    sellerUsdt: number;
  } {
    return {
      buyerUsdt: envNum("PAPER_BUYER_USDT", 100),
      sellerUsdt: envNum("PAPER_SELLER_USDT", 10),
    };
  }
}
